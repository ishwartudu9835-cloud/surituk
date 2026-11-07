import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, creatorsTable, creatorSubscriptionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const creatorIdOf = (raw: string | string[]) => parseInt(Array.isArray(raw) ? raw[0] : raw, 10);

/** Is the current user subscribed? (works logged-out too) */
router.get("/creators/:creatorId/subscription", async (req, res): Promise<void> => {
  const creatorId = creatorIdOf(req.params.creatorId);
  const [c] = await db.select({ followers: creatorsTable.followers }).from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  if (!c) { res.status(404).json({ error: "Creator not found" }); return; }
  let subscribed = false;
  if (req.user) {
    const [s] = await db.select({ id: creatorSubscriptionsTable.id }).from(creatorSubscriptionsTable)
      .where(and(eq(creatorSubscriptionsTable.userId, req.user.id), eq(creatorSubscriptionsTable.creatorId, creatorId)));
    subscribed = Boolean(s);
  }
  res.json({ subscribed, subscribers: c.followers, isMe: req.user?.creatorId === creatorId });
});

router.post("/creators/:creatorId/subscribe", requireAuth, async (req, res): Promise<void> => {
  const creatorId = creatorIdOf(req.params.creatorId);
  if (req.user!.creatorId === creatorId) { res.status(400).json({ error: "You can't subscribe to yourself" }); return; }
  const [c] = await db.select({ id: creatorsTable.id }).from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  if (!c) { res.status(404).json({ error: "Creator not found" }); return; }
  const inserted = await db.insert(creatorSubscriptionsTable).values({ userId: req.user!.id, creatorId }).onConflictDoNothing().returning();
  if (inserted.length) await db.update(creatorsTable).set({ followers: sql`${creatorsTable.followers} + 1` }).where(eq(creatorsTable.id, creatorId));
  const [after] = await db.select({ followers: creatorsTable.followers }).from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  res.json({ subscribed: true, subscribers: after.followers });
});

router.delete("/creators/:creatorId/subscribe", requireAuth, async (req, res): Promise<void> => {
  const creatorId = creatorIdOf(req.params.creatorId);
  const removed = await db.delete(creatorSubscriptionsTable)
    .where(and(eq(creatorSubscriptionsTable.userId, req.user!.id), eq(creatorSubscriptionsTable.creatorId, creatorId))).returning();
  if (removed.length) await db.update(creatorsTable).set({ followers: sql`greatest(${creatorsTable.followers} - 1, 0)` }).where(eq(creatorsTable.id, creatorId));
  const [after] = await db.select({ followers: creatorsTable.followers }).from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  res.json({ subscribed: false, subscribers: after?.followers ?? 0 });
});

/** Creators the current user is subscribed to. */
router.get("/me/subscriptions", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select({
    id: creatorsTable.id, name: creatorsTable.name, studioName: creatorsTable.studioName,
    avatar: creatorsTable.avatar, followers: creatorsTable.followers, totalManga: creatorsTable.totalManga,
  }).from(creatorSubscriptionsTable)
    .innerJoin(creatorsTable, eq(creatorSubscriptionsTable.creatorId, creatorsTable.id))
    .where(eq(creatorSubscriptionsTable.userId, req.user!.id))
    .orderBy(desc(creatorSubscriptionsTable.createdAt));
  res.json(rows);
});

export default router;
