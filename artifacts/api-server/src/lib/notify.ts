import { eq } from "drizzle-orm";
import { db, creatorSubscriptionsTable, notificationsTable } from "@workspace/db";
import { logger } from "./logger";

/** Sends an in-app notification to everyone subscribed to a creator. */
export async function notifySubscribers(creatorId: number, message: string, relatedId?: number, type = "new_chapter") {
  try {
    const subs = await db.select({ userId: creatorSubscriptionsTable.userId })
      .from(creatorSubscriptionsTable).where(eq(creatorSubscriptionsTable.creatorId, creatorId));
    if (!subs.length) return;
    for (let i = 0; i < subs.length; i += 500) {
      await db.insert(notificationsTable).values(subs.slice(i, i + 500).map(s => ({
        userId: s.userId, type, message, relatedId: relatedId ?? null,
      })));
    }
  } catch (err) {
    logger.error({ err }, "notifySubscribers failed");
  }
}
