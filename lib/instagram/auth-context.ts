import { prisma } from "@/lib/db/client";
import { decryptToken } from "@/lib/meta/oauth";

export type AuthProvider = "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";

export interface InstagramAuthContext {
  instagramId: string;
  accessToken: string;
  authProvider: AuthProvider;
  pageId: string | null;
  pageAccessToken: string | null;
}

/**
 * Load auth context for an Instagram account, including credentials and auth provider.
 * Call this before any Meta API operation to get the correct token and routing info.
 */
export async function getInstagramAuthContext(
  instagramAccountId: string
): Promise<InstagramAuthContext> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: instagramAccountId },
    select: {
      instagramId: true,
      accessToken: true,
      authProvider: true,
      pageId: true,
      pageAccessToken: true,
    },
  });

  if (!account) {
    throw new Error(`Instagram account ${instagramAccountId} not found`);
  }

  return {
    instagramId: account.instagramId,
    accessToken: decryptToken(account.accessToken),
    authProvider: account.authProvider,
    pageId: account.pageId ? decryptToken(account.pageId) : null,
    pageAccessToken: account.pageAccessToken
      ? decryptToken(account.pageAccessToken)
      : null,
  };
}

/**
 * Get the access token to use for a given auth context.
 * For Facebook Login, returns the Page access token; for Instagram Login, returns the account token.
 */
export function getAccessToken(context: InstagramAuthContext): string {
  if (context.authProvider === "FACEBOOK_LOGIN" && context.pageAccessToken) {
    return context.pageAccessToken;
  }
  return context.accessToken;
}
