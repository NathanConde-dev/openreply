/**
 * Follower snapshot job — runs automatically on the worker, no external cron needed.
 *
 * Records one follower total per connected account per day. Instagram retains
 * only ~30 days of account insights, so this job is the only source of longer-range
 * follower history. Missing a run loses that day permanently.
 */
import { Queue } from "bullmq";
import { prisma } from "@/lib/db/client";
import { createInstagramContext } from "@/lib/instagram/provider";
import { getUserInfo } from "@/lib/instagram/provider";
import {
  backfillFollowerHistory,
  recordFollowerSnapshot,
} from "@/lib/reports/follower-history";

const FOLLOWER_SNAPSHOT_JOB_NAME = "follower-snapshot";

/**
 * Schedule the follower-snapshot job to run every day at 4 AM UTC.
 * Called once when the worker boots; BullMQ persists the schedule in Redis.
 */
export async function scheduleFollowerSnapshot(queue: Queue): Promise<void> {
  await queue.add(
    FOLLOWER_SNAPSHOT_JOB_NAME,
    {},
    {
      repeat: {
        pattern: "0 4 * * *", // Every day at 4 AM UTC
      },
      jobId: FOLLOWER_SNAPSHOT_JOB_NAME,
    }
  );
  console.log("[Follower Snapshot] Scheduled daily at 4 AM UTC");
}

/**
 * Process the follower-snapshot job: record current follower count for all accounts.
 */
export async function processFollowerSnapshot(): Promise<void> {
  console.log("[Follower Snapshot] Starting follower snapshot job");

  const accounts = await prisma.instagramAccount.findMany({
    where: {
      OR: [
        { provider: "META", accessToken: { not: "" } },
        { provider: "ZERNIO", zernioAccountId: { not: null } },
      ],
    },
    select: {
      id: true,
      workspaceId: true,
      username: true,
      instagramId: true,
      accessToken: true,
      provider: true,
      zernioAccountId: true,
    },
  });

  console.log(`[Follower Snapshot] Found ${accounts.length} accounts to snapshot`);

  let recorded = 0;
  let backfilled = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      const token = await createInstagramContext(account);
      if (token.provider === "ZERNIO") {
        const imported = await backfillFollowerHistory({
          instagramAccountId: account.id,
          accessToken: token,
          instagramId: account.instagramId,
          currentFollowers: 0,
        });
        backfilled += imported;
        if (imported === 0) {
          console.log(
            `[Follower Snapshot] @${account.username}: Zernio history unavailable (Analytics add-on required)`
          );
        }
        continue;
      }

      const info = await getUserInfo({ context: token });

      if (typeof info.followers_count !== "number") {
        console.warn(
          `[Follower Snapshot] @${account.username}: followers_count not returned`
        );
        failed++;
        continue;
      }

      await recordFollowerSnapshot(account.id, info.followers_count);
      console.log(
        `[Follower Snapshot] @${account.username}: recorded ${info.followers_count} followers`
      );
      recorded++;

      // First time we see this account, try to recover the last 30 days
      const existing = await prisma.followerSnapshot.count({
        where: { instagramAccountId: account.id },
      });
      if (existing <= 1) {
        const imported = await backfillFollowerHistory({
          instagramAccountId: account.id,
          accessToken: token,
          instagramId: account.instagramId,
          currentFollowers: info.followers_count,
        });
        backfilled += imported;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[Follower Snapshot] @${account.username} failed:`,
        errorMessage
      );

      await prisma.operationalEvent
        .create({
          data: {
            source: "FOLLOWER_SNAPSHOT",
            level: "WARNING",
            workspaceId: account.workspaceId,
            message: `Follower snapshot failed for @${account.username}: ${errorMessage}`,
            payload: {
              username: account.username,
              error: errorMessage,
            },
          },
        })
        .catch(console.error);

      failed++;
    }
  }

  console.log(
    `[Follower Snapshot] Completed: ${recorded} recorded, ${backfilled} backfilled, ${failed} failed`
  );
}

/**
 * Check if this job name is the follower-snapshot job.
 */
export function isFollowerSnapshotJob(jobName: string): boolean {
  return jobName === FOLLOWER_SNAPSHOT_JOB_NAME;
}
