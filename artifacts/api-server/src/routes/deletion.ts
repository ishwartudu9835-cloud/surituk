import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, accountDeletionsTable, creatorsTable, usersTable, notificationsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import { audit } from "../lib/creatorProgram";
import { ACCOUNT_MIN_DAYS, COOLING_OFF_DAYS, CREATOR_MIN_DAYS, creatorDeletableFrom, notifyAdmins, runAccountDeletion, runCreatorDeletion } from "../lib/deletion";

const router: IRouter = Router();
const DAY = 86_400_000;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

async function myCreator(userId: number) {
  const [u] = await db.select({ creatorId: usersTable.creatorId }).from(usersTable).where(eq(usersTable.id, userId));
  if (!u?.creatorId) return null;
  const [c] = await db.select().from(creatorsTable).where(eq(creatorsTable.id, u.creatorId));
  return c ?? null;
}

/** What the person can delete, and any request already scheduled. */
router.get("/me/deletion", requireAuth, async (req, res): Promise<void> => {
  const pending = await db.select().from(accountDeletionsTable)
    .where(and(eq(accountDeletionsTable.userId, req.user!.id), eq(accountDeletionsTable.status, "scheduled")))
    .orderBy(desc(accountDeletionsTable.requestedAt));
  const c = await myCreator(req.user!.id);
  const creator = c && c.status !== "deleted" ? (() => {
    const from = creatorDeletableFrom(c);
    return { id: c.id, name: c.name, status: c.status, deletableFrom: from.toISOString(), canDeleteNow: from.getTime() <= Date.now() };
  })() : null;
  const accountFrom = new Date(new Date(req.user!.joinedAt).getTime() + ACCOUNT_MIN_DAYS * DAY);
  res.json({
    coolingOffDays: COOLING_OFF_DAYS, creatorMinDays: CREATOR_MIN_DAYS, accountMinDays: ACCOUNT_MIN_DAYS, creator,
    account: { deletableFrom: accountFrom.toISOString(), canDeleteNow: accountFrom.getTime() <= Date.now() },
    pending: pending.map(p => ({ id: p.id, kind: p.kind, reason: p.reason, requestedAt: iso(p.requestedAt), scheduledFor: iso(p.scheduledFor) })),
  });
});

router.post("/me/deletion", requireAuth, async (req, res): Promise<void> => {
  const kind = req.body?.kind === "creator" ? "creator" : "account";
  const reason = String(req.body?.reason ?? "").trim().slice(0, 1000);
  if (reason.length < 10) { res.status(400).json({ error: "Please tell us why, in at least a few words." }); return; }
  if (String(req.body?.confirm ?? "").trim().toUpperCase() !== "DELETE") { res.status(400).json({ error: "Type DELETE to confirm" }); return; }
  if (req.user!.role === "admin" && kind === "account") { res.status(400).json({ error: "Remove your admin rights (ask another admin) before deleting this account." }); return; }

  const [existing] = await db.select({ id: accountDeletionsTable.id, kind: accountDeletionsTable.kind }).from(accountDeletionsTable)
    .where(and(eq(accountDeletionsTable.userId, req.user!.id), eq(accountDeletionsTable.status, "scheduled")));
  if (existing && (existing.kind === kind || existing.kind === "account")) { res.status(409).json({ error: "A deletion is already scheduled. You can cancel it below." }); return; }

  if (kind === "account") {
    const from = new Date(new Date(req.user!.joinedAt).getTime() + ACCOUNT_MIN_DAYS * DAY);
    if (from.getTime() > Date.now()) {
      res.status(400).json({ error: `New accounts can be deleted ${ACCOUNT_MIN_DAYS} days after sign-up. You can request this from ${from.toLocaleDateString("en-IN")}.` }); return;
    }
  }

  let creatorId: number | null = null;
  let creatorName = "";
  if (kind === "creator") {
    const c = await myCreator(req.user!.id);
    if (!c || c.status === "deleted") { res.status(400).json({ error: "You don't have a creator account" }); return; }
    if (c.ownerUserId !== req.user!.id) { res.status(403).json({ error: "Only the owner can delete this creator account" }); return; }
    const from = creatorDeletableFrom(c);
    if (c.status === "approved" && from.getTime() > Date.now()) {
      res.status(400).json({ error: `Creator accounts can be deleted ${CREATOR_MIN_DAYS} days after approval. You can request this from ${from.toLocaleDateString("en-IN")}.` }); return;
    }
    creatorId = c.id; creatorName = c.name;
  }

  const scheduledFor = new Date(Date.now() + COOLING_OFF_DAYS * DAY);
  const [d] = await db.insert(accountDeletionsTable).values({ userId: req.user!.id, kind, creatorId, reason, scheduledFor }).returning();

  const when = scheduledFor.toLocaleDateString("en-IN");
  await db.insert(notificationsTable).values({
    userId: req.user!.id, type: "account",
    message: kind === "creator"
      ? `Your creator account "${creatorName}" will be deleted on ${when}, with all its stories and posts. You can cancel before then in Settings → Account.`
      : `Your Surituk account will be deleted on ${when}. You can cancel before then in Settings → Account.`,
  });
  await notifyAdmins(kind === "creator"
    ? `🗑️ Creator "${creatorName}" asked to delete their creator account (scheduled ${when}). Reason: ${reason}`
    : `🗑️ ${req.user!.displayName} (@${req.user!.username}) asked to delete their account (scheduled ${when}). Reason: ${reason}`);
  await audit(req.user!.id, `deletion.request.${kind}`, kind === "creator" ? "creator" : "user", creatorId ?? req.user!.id, { reason, scheduledFor: when });
  res.status(201).json({ ok: true, id: d.id, scheduledFor: iso(scheduledFor) });
});

router.delete("/me/deletion/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [d] = await db.update(accountDeletionsTable).set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(accountDeletionsTable.id, id), eq(accountDeletionsTable.userId, req.user!.id), eq(accountDeletionsTable.status, "scheduled"))).returning();
  if (!d) { res.status(404).json({ error: "No scheduled deletion found" }); return; }
  await notifyAdmins(`↩️ ${req.user!.displayName} cancelled their ${d.kind === "creator" ? "creator account" : "account"} deletion.`);
  await audit(req.user!.id, `deletion.cancel.${d.kind}`, "user", req.user!.id, {});
  res.json({ ok: true });
});

/* ---------------- Admin ---------------- */

router.get("/admin/deletions", requireAdmin, async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "scheduled");
  const rows = await db.select({ d: accountDeletionsTable, displayName: usersTable.displayName, username: usersTable.username, email: usersTable.email, creatorName: creatorsTable.name })
    .from(accountDeletionsTable)
    .leftJoin(usersTable, eq(accountDeletionsTable.userId, usersTable.id))
    .leftJoin(creatorsTable, eq(accountDeletionsTable.creatorId, creatorsTable.id))
    .where(status === "all" ? undefined : eq(accountDeletionsTable.status, status))
    .orderBy(desc(accountDeletionsTable.requestedAt)).limit(200);
  res.json(rows.map(({ d, ...r }) => ({
    id: d.id, userId: d.userId, kind: d.kind, creatorId: d.creatorId, reason: d.reason, status: d.status,
    requestedAt: iso(d.requestedAt), scheduledFor: iso(d.scheduledFor), completedAt: iso(d.completedAt), cancelledAt: iso(d.cancelledAt), ...r,
  })));
});

/** Delete right away instead of waiting for the cooling-off period to end. */
router.post("/admin/deletions/:id/run", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [d] = await db.select().from(accountDeletionsTable).where(and(eq(accountDeletionsTable.id, id), eq(accountDeletionsTable.status, "scheduled")));
  if (!d) { res.status(404).json({ error: "No scheduled deletion found" }); return; }
  if (d.kind === "creator" && d.creatorId) await runCreatorDeletion(d.creatorId, d.reason);
  else await runAccountDeletion(d.userId, d.reason);
  await db.update(accountDeletionsTable).set({ status: "completed", completedAt: new Date() }).where(eq(accountDeletionsTable.id, id));
  await audit(req.user!.id, `deletion.run.${d.kind}`, d.kind === "creator" ? "creator" : "user", d.creatorId ?? d.userId, { reason: d.reason });
  res.json({ ok: true });
});

router.post("/admin/deletions/:id/cancel", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const note = String(req.body?.reason ?? "").trim().slice(0, 300);
  const [d] = await db.update(accountDeletionsTable).set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(accountDeletionsTable.id, id), eq(accountDeletionsTable.status, "scheduled"))).returning();
  if (!d) { res.status(404).json({ error: "No scheduled deletion found" }); return; }
  await db.insert(notificationsTable).values({ userId: d.userId, type: "account", message: `Your deletion request was put on hold by Surituk.${note ? ` Reason: ${note}` : ""} Contact support for details.` });
  await audit(req.user!.id, `deletion.hold.${d.kind}`, "user", d.userId, { note });
  res.json({ ok: true });
});

export default router;
