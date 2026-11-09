/**
 * Token refresh job — runs automatically on the worker, no external cron needed.
 *
 * BullMQ repeatable jobs are scheduled in Redis and survive restarts. The worker
 * that processes DM jobs also picks this up — one process, one deployment.
 */
import { Queue } from "bullmq";
import { prisma } from "@/lib/db/client";
import { decryptToken, encryptToken } from "@/lib/meta/oauth";
import { refreshLongLivedToken } from "@/lib/meta/client";

const DAYS_BEFORE_EXPIRY = 10;
const TOKEN_REFRESH_JOB_NAME = "token-refresh";

/**
 * Schedule the token-refresh job to run every day at 3 AM UTC.
 * Called once when the worker boots; BullMQ persists the schedule in Redis.
 */
export async function scheduleTokenRefresh(queue: Queue): Promise<void> {
  await queue.add(
    TOKEN_REFRESH_JOB_NAME,
    {},
    {
      repeat: {
        pattern: "0 3 * * *", // Every day at 3 AM UTC
      },
      jobId: TOKEN_REFRESH_JOB_NAME,
    }
  );
  console.log("[Token Refresh] Scheduled daily at 3 AM UTC");
}

/**
 * Process the token-refresh job: find tokens expiring soon and refresh them.
 */
export async function processTokenRefresh(): Promise<void> {
  console.log("[Token Refresh] Starting token refresh job");
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + DAYS_BEFORE_EXPIRY);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Reset monthly DM usage counters
  const usageReset = await prisma.workspace.updateMany({
    where: { usagePeriodStart: { lt: monthStart } },
    data: {
      usagePeriodStart: monthStart,
      dmsSentThisPeriod: 0,
    },
  });

  if (usageReset.count > 0) {
    console.log(`[Token Refresh] Reset usage for ${usageReset.count} workspaces`);
  }

  const accountsToRefresh = await prisma.instagramAccount.findMany({
    where: {
      accessToken: { not: "" },
      provider: "META",
      tokenExpiresAt: {
        not: null,
        lte: cutoffDate,
      },
    },
    select: {
      id: true,
      workspaceId: true,
      username: true,
      accessToken: true,
    },
  });

  console.log(`[Token Refresh] Found ${accountsToRefresh.length} tokens to refresh`);

  let refreshed = 0;
  let failed = 0;

  for (const account of accountsToRefresh) {
    try {
      const currentToken = decryptToken(account.accessToken);
      const { accessToken: newToken, expiresIn } = await refreshLongLivedToken(currentToken);
      const encryptedToken = encryptToken(newToken);
      const newExpiry = new Date(Date.now() + expiresIn * 1000);

      await prisma.instagramAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encryptedToken,
          tokenExpiresAt: newExpiry,
        },
      });

      console.log(`[Token Refresh] Refreshed token for @${account.username}`);
      refreshed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Token Refresh] Failed for @${account.username}:`, errorMessage);
      
      await prisma.operationalEvent.create({
        data: {
          workspaceId: account.workspaceId,
          source: "TOKEN_REFRESH",
          level: "ERROR",
          message: `Token refresh failed for @${account.username}: ${errorMessage}`,
          payload: {
            instagramAccountId: account.id,
            username: account.username,
          },
        },
      }).catch(console.error);

      failed++;
    }
  }

  console.log(`[Token Refresh] Completed: ${refreshed} refreshed, ${failed} failed`);
}

/**
 * Check if this job name is the token-refresh job.
 */
export function isTokenRefreshJob(jobName: string): boolean {
  return jobName === TOKEN_REFRESH_JOB_NAME;
}
