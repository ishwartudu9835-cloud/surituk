import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, reportsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

/** Readers report content. Admins review it in Admin → Reports. */
const router: IRouter = Router();

export const REPORT_TARGETS = ["manga", "chapter", "post", "comment", "creator", "user"] as const;
export const REPORT_REASONS = ["copyright", "spam", "abuse", "adult", "violence", "misleading", "other"] as const;

router.post("/reports", requireAuth, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const targetType = String(b.targetType ?? "");
  const targetId = parseInt(String(b.targetId ?? ""), 10);
  const reason = String(b.reason ?? "");
  if (!(REPORT_TARGETS as readonly string[]).includes(targetType) || !targetId) { res.status(400).json({ error: "Invalid report" }); return; }
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) { res.status(400).json({ error: "Choose a reason" }); return; }
  const details = String(b.details ?? "").trim().slice(0, 3000);

  let claimantName: string | null = null, claimantEmail: string | null = null, originalUrl: string | null = null;
  if (reason === "copyright") {
    claimantName = String(b.claimantName ?? "").trim().slice(0, 120);
    claimantEmail = String(b.claimantEmail ?? "").trim().slice(0, 200);
    originalUrl = String(b.originalUrl ?? "").trim().slice(0, 500);
    if (!claimantName || !/^\S+@\S+\.\S+$/.test(claimantEmail) || details.length < 10 || b.goodFaith !== true) {
      res.status(400).json({ error: "For copyright, add your name, email, what was copied, and confirm the statement." }); return;
    }
  }

  // One open report per person per item.
  const [dup] = await db.select({ id: reportsTable.id }).from(reportsTable).where(and(
    eq(reportsTable.reporterId, req.user!.id), eq(reportsTable.targetType, targetType), eq(reportsTable.targetId, targetId), eq(reportsTable.status, "open")));
  if (dup) { res.json({ ok: true, id: dup.id, duplicate: true }); return; }

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(reportsTable)
    .where(and(eq(reportsTable.reporterId, req.user!.id), sql`${reportsTable.createdAt} > now() - interval '1 day'`));
  if (n >= 20) { res.status(429).json({ error: "You've sent a lot of reports today. Our team will review them." }); return; }

  const [r] = await db.insert(reportsTable).values({
    reporterId: req.user!.id, targetType, targetId, reason, details: details || null, claimantName, claimantEmail, originalUrl,
  }).returning({ id: reportsTable.id });
  res.status(201).json({ ok: true, id: r.id });
});

export default router;
