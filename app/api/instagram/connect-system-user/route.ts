import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { canConnectInstagramAccount } from "@/lib/instagram-accounts";
import { 
  discoverInstagramAccountsFromSUAT,
  subscribeInstagramAccountToWebhooks,
  debugToken
} from "@/lib/meta/client";
import { encryptToken } from "@/lib/meta/oauth";
import { requireEnv } from "@/lib/env";
import { canManageWorkspace } from "@/lib/workspace-access";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { accessToken: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.accessToken || typeof body.accessToken !== "string") {
    return NextResponse.json({ error: "accessToken é obrigatório" }, { status: 400 });
  }

  // Get user's workspace (first one they're a member of)
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
    },
    include: {
      workspace: true,
    },
  });

  if (!membership || !canManageWorkspace(membership.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const workspaceId = membership.workspaceId;
  const accessToken = body.accessToken.trim();

  try {
    // Validate token with debug_token
    const appAccessToken = `${requireEnv("INSTAGRAM_APP_ID")}|${requireEnv("INSTAGRAM_APP_SECRET")}`;
    const debugData = await debugToken(accessToken, appAccessToken) as {
      data: {
        is_valid?: boolean;
        app_id?: string;
        type?: string;
      };
    };

    if (!debugData.data.is_valid) {
      return NextResponse.json(
        { error: "Token inválido ou expirado" },
        { status: 400 }
      );
    }

    if (debugData.data.app_id !== requireEnv("INSTAGRAM_APP_ID")) {
      return NextResponse.json(
        { error: "Token não pertence a este app" },
        { status: 400 }
      );
    }

    // Accept SYSTEM_USER and USER types
    if (debugData.data.type !== "SYSTEM_USER" && debugData.data.type !== "USER") {
      return NextResponse.json(
        { error: `Tipo de token não suportado: ${debugData.data.type}. Esperado: SYSTEM_USER ou USER` },
        { status: 400 }
      );
    }

    // Discover Instagram accounts using existing SUAT discovery
    const discoveredAccounts = await discoverInstagramAccountsFromSUAT(accessToken);

    if (discoveredAccounts.length === 0) {
      return NextResponse.json(
        {
          error: "Token não tem contas do Instagram atribuídas. " +
            "No Business Manager, vá em Configurações comerciais > Usuários do sistema, " +
            "selecione seu usuário do sistema, adicione ativos: este app + a conta do Instagram com controle total, " +
            "e gere um novo token com as permissões necessárias."
        },
        { status: 400 }
      );
    }

    // For now, connect the first account found
    const account = discoveredAccounts[0];
    const { instagramId, username, name, pageId, pageAccessToken } = account;

    // Check if account can be connected
    const connection = await canConnectInstagramAccount({
      workspaceId,
      instagramId,
    });

    if (!connection.allowed) {
      return NextResponse.json(
        { error: "Esta conta já está conectada a outro workspace" },
        { status: 400 }
      );
    }

    const encryptedToken = encryptToken(accessToken);
    const authProvider: "FACEBOOK_LOGIN" = "FACEBOOK_LOGIN";
    const tokenExpiresAt = null; // System User tokens don't expire

    // Attempt webhook subscription
    let webhookSubscribed = false;
    try {
      const tokenForWebhook = pageAccessToken || accessToken;
      const subscription = await subscribeInstagramAccountToWebhooks(
        instagramId,
        pageId,
        tokenForWebhook,
        authProvider
      );
      webhookSubscribed = Boolean(subscription.success);
    } catch (subscriptionError) {
      console.warn(
        "[System User Connect] Webhook subscription failed:",
        subscriptionError
      );
    }

    const data = {
      username,
      name: name ?? undefined,
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
        where: { id: existing.id, workspaceId, provider: 'META' },
        data,
      });
      if (!updated.count) {
        return NextResponse.json(
          { error: "Esta conta já está conectada a outro workspace" },
          { status: 400 }
        );
      }
    } else {
      await prisma.instagramAccount.create({
        data: { ...data, workspaceId, instagramId, provider: 'META' }
      });
    }

    return NextResponse.json({
      ok: true,
      username,
      instagramId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[System User Connect] Error:", err);

    await prisma.operationalEvent
      .create({
        data: {
          source: "SYSTEM",
          level: "ERROR",
          workspaceId,
          message: "System User Instagram connection failed",
          payload: { reason: message },
        },
      })
      .catch(() => {});

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
