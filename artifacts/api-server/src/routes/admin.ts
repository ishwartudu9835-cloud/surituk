import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, ordersTable, payoutsTable, creatorsTable, usersTable, productsTable, notificationsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/admin/overview", requireAdmin, async (_req, res): Promise<void> => {
  const [sales] = await db.select({
    orders: sql<number>`count(*)::int`,
    gross: sql<number>`coalesce(sum(${ordersTable.amount}),0)::int`,
    commission: sql<number>`coalesce(sum(${ordersTable.platformFee}),0)::int`,
  }).from(ordersTable).where(eq(ordersTable.status, "paid"));
  const [users] = await db.select({ n: sql<number>`count(*)::int` }).from(usersTable);
  const [creators] = await db.select({ n: sql<number>`count(*)::int` }).from(creatorsTable);
  const [books] = await db.select({ n: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.status, "active"));
  const [pending] = await db.select({ n: sql<number>`count(*)::int`, amount: sql<number>`coalesce(sum(${payoutsTable.amount}),0)::int` })
    .from(payoutsTable).where(eq(payoutsTable.status, "requested"));
  res.json({ ...sales, users: users.n, creators: creators.n, books: books.n, pendingPayouts: pending.n, pendingPayoutAmount: pending.amount });
});

router.get("/admin/payouts", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select({ p: payoutsTable, creatorName: creatorsTable.name, payoutName: creatorsTable.payoutName })
    .from(payoutsTable).leftJoin(creatorsTable, eq(payoutsTable.creatorId, creatorsTable.id))
    .orderBy(desc(payoutsTable.createdAt)).limit(200);
  res.json(rows.map(({ p, creatorName, payoutName }) => ({
    ...p, creatorName, payoutName, createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null,
  })));
});

router.patch("/admin/payouts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["paid", "rejected"].includes(status)) { res.status(400).json({ error: "status must be paid or rejected" }); return; }
  const note = String(req.body?.note ?? "").trim().slice(0, 200) || null;
  const [p] = await db.update(payoutsTable).set({ status, note, paidAt: status === "paid" ? new Date() : null })
    .where(and(eq(payoutsTable.id, id), eq(payoutsTable.status, "requested"))).returning();
  if (!p) { res.status(404).json({ error: "Pending payout not found" }); return; }
  const owners = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.creatorId, p.creatorId));
  for (const o of owners) {
    await db.insert(notificationsTable).values({
      userId: o.id, type: "reward",
      message: status === "paid" ? `₹${(p.amount / 100).toFixed(2)} has been sent to ${p.upiId}.${note ? ` Ref: ${note}` : ""}` : `Your withdrawal was not processed.${note ? ` Reason: ${note}` : ""}`,
    });
  }
  res.json({ ok: true });
});

router.get("/admin/orders", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select({ o: ordersTable, title: productsTable.title, buyer: usersTable.email, creator: creatorsTable.name })
    .from(ordersTable)
    .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .leftJoin(creatorsTable, eq(ordersTable.creatorId, creatorsTable.id))
    .orderBy(desc(ordersTable.createdAt)).limit(200);
  res.json(rows.map(({ o, title, buyer, creator }) => ({
    id: o.id, merchantOrderId: o.merchantOrderId, productTitle: title, buyer, creator, format: o.format,
    amount: o.amount, platformFee: o.platformFee, status: o.status, fulfillment: o.fulfillment, createdAt: o.createdAt.toISOString(),
  })));
});

export default router;
