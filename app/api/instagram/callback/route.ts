import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getBaseUrl, isMetaUnifiedLoginEnabled } from "@/lib/env";
import { canConnectInstagramAccount } from "@/lib/instagram-accounts";
import { 
  getLongLivedToken, 
  getUserInfo, 
  discoverInstagramAccountsFromSUAT,
  subscribeInstagramAccountToWebhooks 
} from "@/lib/meta/client";
import {
  encryptToken,
  exchangeCodeForToken,
  verifyOAuthState,
} from "@/lib/meta/oauth";
import { canManageWorkspace } from "@/lib/workspace-access";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = verifyOAuthState(request.nextUrl.searchParams.get("state"));
  const baseUrl = getBaseUrl();

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?instagram=denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/settings?instagram=invalid`);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: state.workspaceId,
      userId: session.user.id,
    },
  });

  if (!membership || !canManageWorkspace(membership.role)) {
    return NextResponse.redirect(`${baseUrl}/settings?instagram=forbidden`);
  }

  try {
    const redirectUri = `${baseUrl}/api/instagram/callback`;
    const { accessToken: shortLivedToken } = await exchangeCodeForToken(
      code,
      redirectUri
    );

    let longLivedToken: string;
    let expiresIn: number;
    let authProvider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
    let pageId: string | null = null;
    let pageAccessToken: string | null = null;
    const instagramAccounts: Array<{
      instagramId: string;
      username: string;
      name?: string;
      pageId?: string;
      pageAccessToken?: string;
    }> = [];

    if (isMetaUnifiedLoginEnabled()) {
      // Meta Unified Login flow: SUAT doesn't need exchange to long-lived
      // According to Meta docs, SUATs with "Never" expiration don't expire
      longLivedToken = shortLivedToken;
      expiresIn = 0; // Will be stored as null (no expiration)
      authProvider = "FACEBOOK_LOGIN";

      // Discover Instagram accounts granted to this SUAT via debug_token
      const discoveredAccounts = await discoverInstagramAccountsFromSUAT(longLivedToken);
      
      if (discoveredAccounts.length === 0) {
        throw new Error(
          "No Instagram Business accounts found. Make sure your configuration includes Instagram account access."
        );
      }

      // For now, connect the first account found
      // TODO: In the future, we could show a UI to let users choose which account to connect
      const account = discoveredAccounts[0];
      instagramAccounts.push({
        instagramId: account.instagramId,
        username: account.username,
        name: account.name,
        pageId: account.pageId ?? undefined,
        pageAccessToken: account.pageAccessToken ?? undefined,
      });
    } else {
      // Legacy Instagram Login flow
      const { accessToken: token, expiresIn: expires } =
        await getLongLivedToken(shortLivedToken);
      longLivedToken = token;
      expiresIn = expires;
      authProvider = "INSTAGRAM_LOGIN";

      const userInfo = await getUserInfo(longLivedToken);
      // Webhooks and the messaging API key off the professional account ID
      // (user_id), not the app-scoped `id`. Store user_id so comment webhooks
      // can be matched back to this account. Fall back to id if user_id is
      // ever absent.
      const instagramId = userInfo.user_id ?? userInfo.id;
      instagramAccounts.push({
        instagramId,
        username: userInfo.username,
        name: userInfo.name,
      });
    }

    // Process the discovered account(s) - for now just the first one
    const { instagramId, username, name } = instagramAccounts[0];
    
    // For Facebook Login, extract and store Page credentials
    if (authProvider === "FACEBOOK_LOGIN") {
      pageId = instagramAccounts[0].pageId ?? null;
      pageAccessToken = instagramAccounts[0].pageAccessToken ?? null;
      
      // Warn if Page info is missing (messaging may not work)
      if (!pageId || !pageAccessToken) {
        console.warn(
          `[Instagram Callback] Connected @${username} without Page association. ` +
            `Messaging may not work. Check Facebook Login configuration.`
        );
      }
    }

    const connection = await canConnectInstagramAccount({
      workspaceId: state.workspaceId,
      instagramId,
    });

    if (!connection.allowed) {
      return NextResponse.redirect(
        `${baseUrl}/settings?instagram=already_connected`
      );
    }

    const encryptedToken = encryptToken(longLivedToken);
    const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

    let webhookSubscribed = false;
    try {
      // Only attempt webhook subscription if we have the necessary tokens
      if (authProvider === "INSTAGRAM_LOGIN" || (pageId && pageAccessToken)) {
        const subscription = await subscribeInstagramAccountToWebhooks(
          instagramId,
          authProvider === "FACEBOOK_LOGIN" ? pageId : null,
          authProvider === "FACEBOOK_LOGIN" ? pageAccessToken! : longLivedToken,
          authProvider
        );
        webhookSubscribed = Boolean(subscription.success);
      } else {
        console.warn(
          "[Instagram Callback] Skipping webhook subscription - no Page token available"
        );
      }
    } catch (subscriptionError) {
      console.warn(
        "[Instagram Callback] Webhook subscription failed:",
        subscriptionError
      );
    }

    const data = {
      username,
      name,
      authProvider,
      pageId: pageId ? encryptToken(pageId) : null,
      pageAccessToken: pageAccessToken ? encryptToken(pageAccessToken) : null,
      accessToken: encryptedToken,
      tokenExpiresAt,
      webhookSubscribed,
    };
    const existing = await prisma.instagramAccount.findUnique({ where: { instagramId } });
    if (existing) {
      const updated = await prisma.instagramAccount.updateMany({
        where: { id: existing.id, workspaceId: state.workspaceId, provider: 'META' }, data,
      });
      if (!updated.count) return NextResponse.redirect(`${baseUrl}/settings?instagram=already_connected`);
    } else {
      await prisma.instagramAccount.create({ data: { ...data, workspaceId: state.workspaceId, instagramId, provider: 'META' } });
    }

    return NextResponse.redirect(`${baseUrl}/dashboard?connected=true`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Instagram Callback] Error:", err);
    // The message is the only diagnostic a self-hoster gets for a failed
    // connect, so persist it alongside the other operational events rather
    // than leaving it in server logs they may not be able to reach.
    await prisma.operationalEvent
      .create({
        data: {
          source: "SYSTEM",
          level: "ERROR",
          workspaceId: state.workspaceId,
          message: "Instagram connection failed",
          payload: { reason: message },
        },
      })
      .catch(() => {});

    return NextResponse.redirect(
      `${baseUrl}/settings?instagram=failed&reason=${encodeURIComponent(
        message.slice(0, 200)
      )}`
    );
  }
}
