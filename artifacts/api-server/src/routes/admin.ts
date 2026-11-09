import { assignCreatorSlug } from "../lib/slug";
import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  db, ordersTable, payoutsTable, creatorsTable, usersTable, productsTable, mangaTable,
  creatorApplicationsTable, creatorInvitesTable, adminAuditLogTable, teamMembersTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import { features, config } from "../lib/config";
import { approveApplication, audit, getSetting, notifyUser, setSetting } from "../lib/creatorProgram";

const router: IRouter = Router();
const id = (v: unknown) => parseInt(Array.isArray(v) ? v[0] : String(v), 10);
const mask = (m: string) => (m.length >= 4 ? `XXXXXX${m.slice(-4)}` : m);

/* ---------------- Overview & settings ---------------- */

router.get("/admin/overview", requireAdmin, async (_req, res): Promise<void> => {
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const n = sql<number>`count(*)::int`;
  res.json({
    users: await count(db.select({ n }).from(usersTable)),
    creators: await count(db.select({ n }).from(creatorsTable).where(eq(creatorsTable.status, "approved"))),
    studios: await count(db.select({ n }).from(creatorsTable).where(and(eq(creatorsTable.status, "approved"), eq(creatorsTable.type, "studio")))),
    pendingApplications: await count(db.select({ n }).from(creatorApplicationsTable).where(eq(creatorApplicationsTable.status, "pending"))),
    series: await count(db.select({ n }).from(mangaTable).where(eq(mangaTable.isPublished, true))),
    drafts: await count(db.select({ n }).from(mangaTable).where(eq(mangaTable.isPublished, false))),
    newCreatorMode: await getSetting("new_creator_mode", "manual"),
    storeEnabled: features.store,
  });
});

router.patch("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const mode = String(req.body?.newCreatorMode ?? "");
  if (!["manual", "auto"].includes(mode)) { res.status(400).json({ error: "Mode must be manual or auto" }); return; }
  await setSetting("new_creator_mode", mode);
  await audit(req.user!.id, "settings.new_creator_mode", "setting", undefined, { mode });
  res.json({ newCreatorMode: mode });
});

/* ---------------- Applications ---------------- */

router.get("/admin/applications", requireAdmin, async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "pending");
  const where: SQL | undefined = status === "all" ? undefined : eq(creatorApplicationsTable.status, status);
  const rows = await db.select({ a: creatorApplicationsTable, account: usersTable.email, joinedAt: usersTable.joinedAt })
    .from(creatorApplicationsTable).leftJoin(usersTable, eq(creatorApplicationsTable.userId, usersTable.id))
    .where(where).orderBy(desc(creatorApplicationsTable.createdAt)).limit(200);
  res.json(rows.map(({ a, account, joinedAt }) => ({
    ...a, mobileMasked: mask(a.mobile), accountEmail: account, accountJoinedAt: joinedAt?.toISOString() ?? null,
    daysWaiting: Math.max(1, Math.ceil((Date.now() - a.updatedAt.getTime()) / 86_400_000)),
    createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(), reviewedAt: a.reviewedAt?.toISOString() ?? null,
  })));
});

router.patch("/admin/applications/:id", requireAdmin, async (req, res): Promise<void> => {
  const codeVerified = req.body?.codeVerified;
  if (typeof codeVerified !== "boolean") { res.status(400).json({ error: "codeVerified (true/false) required" }); return; }
  const [a] = await db.update(creatorApplicationsTable).set({ codeVerified }).where(eq(creatorApplicationsTable.id, id(req.params.id))).returning();
  if (!a) { res.status(404).json({ error: "Not found" }); return; }
  await audit(req.user!.id, "application.code_verified", "application", a.id, { codeVerified });
  res.json({ ok: true });
});

router.post("/admin/applications/:id/decision", requireAdmin, async (req, res): Promise<void> => {
  const action = String(req.body?.action ?? "");
  const note = String(req.body?.note ?? "").trim().slice(0, 1000) || null;
  const [app] = await db.select().from(creatorApplicationsTable).where(eq(creatorApplicationsTable.id, id(req.params.id)));
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }
  if (!["pending", "more_info"].includes(app.status)) { res.status(400).json({ error: `Already ${app.status}` }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, app.userId));

  if (action === "approve") {
    await approveApplication(app, req.user!.id, note ?? undefined);
  } else if (action === "reject" || action === "more_info") {
    if (!note) { res.status(400).json({ error: action === "reject" ? "Write the reason for rejection" : "Write what information you need" }); return; }
    await db.update(creatorApplicationsTable).set({ status: action === "reject" ? "rejected" : "more_info", reviewNote: note, reviewedBy: req.user!.id, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(creatorApplicationsTable.id, app.id));
    if (user) {
      const rejected = action === "reject";
      await notifyUser(user.id, rejected ? `Your creator application was not approved. Reason: ${note}` : `More information needed for your creator application: ${note}`, {
        to: user.email ?? app.email,
        subject: rejected ? "Update on your Surituk creator application" : "Surituk needs a bit more information",
        title: rejected ? "Application not approved" : "More information needed",
        body: `<p>${rejected ? "Thank you for applying. We couldn't approve your application this time." : "Thanks for applying! Before we can approve, we need:"}</p><p><b>${note.replace(/[<>&]/g, "")}</b></p>${rejected ? "<p>You can apply again after fixing this.</p>" : ""}`,
        cta: { label: rejected ? "View details" : "Update application", url: `${config.frontendUrl}/settings?tab=pro` },
      });
    }
  } else { res.status(400).json({ error: "Unknown action" }); return; }

  await audit(req.user!.id, `application.${action}`, "application", app.id, { note, userId: app.userId, penName: app.penName });
  res.json({ ok: true });
});

/* ---------------- Creators ---------------- */

router.get("/admin/creators", requireAdmin, async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "all");
  const rows = await db.select({ c: creatorsTable, ownerEmail: usersTable.email })
    .from(creatorsTable).leftJoin(usersTable, eq(creatorsTable.ownerUserId, usersTable.id))
    .where(status === "all" ? undefined : eq(creatorsTable.status, status))
    .orderBy(desc(creatorsTable.joinedAt)).limit(500);
  res.json(rows.map(({ c, ownerEmail }) => ({
    id: c.id, name: c.name, type: c.type, status: c.status, avatar: c.avatar, city: c.city, state: c.state,
    isVerified: c.isVerified, isRegisteredStudio: c.isRegisteredStudio, totalManga: c.totalManga, totalViews: c.totalViews,
    followers: c.followers, ownerEmail, ownerUserId: c.ownerUserId, strikes: c.strikes, hidden: c.hidden, slug: c.slug, joinedAt: c.joinedAt.toISOString(),
  })));
});

router.patch("/admin/creators/:id", requireAdmin, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const patch: Partial<typeof creatorsTable.$inferInsert> = {};
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  if (b.status !== undefined) {
    if (!["approved", "suspended", "banned", "revoked"].includes(b.status)) { res.status(400).json({ error: "Invalid status" }); return; }
    patch.status = b.status;
    if (b.status === "approved") {
      const [cur] = await db.select({ approvedAt: creatorsTable.approvedAt }).from(creatorsTable).where(eq(creatorsTable.id, id(req.params.id)));
      if (!cur?.approvedAt) patch.approvedAt = new Date();
    }
  }
  if (typeof b.hidden === "boolean") patch.hidden = b.hidden;
  if (typeof b.isVerified === "boolean") patch.isVerified = b.isVerified;
  if (typeof b.isRegisteredStudio === "boolean") patch.isRegisteredStudio = b.isRegisteredStudio;
  const [c] = await db.update(creatorsTable).set(patch).where(eq(creatorsTable.id, id(req.params.id))).returning();
  if (!c) { res.status(404).json({ error: "Creator not found" }); return; }
  const why = reason ? ` Reason: ${reason.replace(/[.!]?$/, ".")}` : "";
  if (patch.status && c.ownerUserId) {
    const msg = patch.status === "suspended" ? `Your creator account has been suspended — your stories are hidden and you can't publish.${why} Contact support to appeal.`
      : patch.status === "banned" ? `Your creator account has been banned for breaking Surituk's rules.${why}`
      : patch.status === "revoked" ? `Your creator access has been removed by Surituk. You can still read and comment as a reader.${why} Contact support to appeal.`
      : "Your creator account is active again.";
    await notifyUser(c.ownerUserId, msg);
  }
  if (typeof patch.hidden === "boolean" && c.ownerUserId) {
    await notifyUser(c.ownerUserId, patch.hidden
      ? `Your creator page and stories have been hidden from readers by Surituk.${why} Contact support to appeal.`
      : "Your creator page and stories are visible to readers again.");
  }
  await audit(req.user!.id, "creator.update", "creator", c.id, { ...patch, name: c.name, reason });
  res.json({ ok: true });
});

/** Admin creates an approved creator directly for an email (user account is created if needed). */
router.post("/admin/creators", requireAdmin, async (req, res): Promise<void> => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const name = String(req.body?.name ?? "").trim().slice(0, 60);
  const type = req.body?.type === "studio" ? "studio" : "individual";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || name.length < 2) { res.status(400).json({ error: "Valid email and name required" }); return; }
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (user?.creatorId) { res.status(400).json({ error: "This user already has a creator account" }); return; }
  if (!user) {
    const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16) || "creator";
    [user] = await db.insert(usersTable).values({
      email, username: `${base}${crypto.randomInt(1000, 9999)}`, displayName: name,
      avatar: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2a2420"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Georgia,serif" font-size="30" fill="#E1191F">${(name[0] ?? "S").toUpperCase().replace(/[<>&"']/g, "S")}</text></svg>`).toString("base64")}`,
    }).returning();
  }
  const code = `${name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "creator"}${crypto.randomInt(100, 9999)}`;
  const [c] = await db.insert(creatorsTable).values({ name, type, status: "approved", approvedAt: new Date(), avatar: user.avatar, ownerUserId: user.id, referralCode: code }).returning();
    c.slug = await assignCreatorSlug(c.id, c.name);
  await db.update(usersTable).set({ creatorId: c.id, role: user.role === "admin" ? "admin" : "creator" }).where(eq(usersTable.id, user.id));
  if (type === "studio") await db.insert(teamMembersTable).values({ creatorId: c.id, userId: user.id, name, email, role: "owner", status: "active" });
  await notifyUser(user.id, "You've been added as a creator on Surituk. Creator Studio is open.", {
    to: email, subject: "Your Surituk creator account is ready", title: "Welcome to Surituk Creators!",
    body: `<p>The Surituk team created a ${type === "studio" ? "studio" : "creator"} account <b>${name.replace(/[<>&]/g, "")}</b> for you. Log in with this email to start publishing.</p>`,
    cta: { label: "Log in", url: `${config.frontendUrl}/login?next=/creator-dashboard` },
  });
  await audit(req.user!.id, "creator.add_direct", "creator", c.id, { email, name, type });
  res.status(201).json({ id: c.id });
});

/* ---------------- Invite links (skip review) ---------------- */

router.get("/admin/invites", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(creatorInvitesTable).orderBy(desc(creatorInvitesTable.createdAt)).limit(100);
  res.json(rows.map(r => ({ ...r, url: `${config.frontendUrl}/join/creator/${r.token}`, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt?.toISOString() ?? null })));
});

router.post("/admin/invites", requireAdmin, async (req, res): Promise<void> => {
  const uses = Math.min(Math.max(parseInt(req.body?.uses, 10) || 1, 1), 100);
  const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 14, 1), 365);
  const token = crypto.randomBytes(12).toString("base64url");
  await db.insert(creatorInvitesTable).values({ token, createdBy: req.user!.id, note: String(req.body?.note ?? "").slice(0, 200) || null, usesLeft: uses, expiresAt: new Date(Date.now() + days * 86_400_000) });
  await audit(req.user!.id, "invite.create", "invite", undefined, { uses, days });
  res.status(201).json({ url: `${config.frontendUrl}/join/creator/${token}` });
});

router.delete("/admin/invites/:token", requireAdmin, async (req, res): Promise<void> => {
  await db.update(creatorInvitesTable).set({ usesLeft: 0 }).where(eq(creatorInvitesTable.token, String(req.params.token)));
  await audit(req.user!.id, "invite.disable", "invite");
  res.json({ ok: true });
});

/* ---------------- Audit log ---------------- */

router.get("/admin/audit-log", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select({ l: adminAuditLogTable, admin: usersTable.email })
    .from(adminAuditLogTable).leftJoin(usersTable, eq(adminAuditLogTable.adminUserId, usersTable.id))
    .orderBy(desc(adminAuditLogTable.createdAt)).limit(200);
  res.json(rows.map(({ l, admin }) => ({ ...l, admin, createdAt: l.createdAt.toISOString() })));
});

/* ---------------- Store (only when the Store feature is on) ---------------- */

if (features.store) {
  router.get("/admin/store/payouts", requireAdmin, async (_req, res): Promise<void> => {
    const rows = await db.select({ p: payoutsTable, creatorName: creatorsTable.name }).from(payoutsTable)
      .leftJoin(creatorsTable, eq(payoutsTable.creatorId, creatorsTable.id)).orderBy(desc(payoutsTable.createdAt)).limit(200);
    res.json(rows.map(({ p, creatorName }) => ({ ...p, creatorName, createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null })));
  });
  router.get("/admin/store/orders", requireAdmin, async (_req, res): Promise<void> => {
    const rows = await db.select({ o: ordersTable, title: productsTable.title }).from(ordersTable)
      .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id)).orderBy(desc(ordersTable.createdAt)).limit(200);
    res.json(rows.map(({ o, title }) => ({ ...o, productTitle: title, createdAt: o.createdAt.toISOString() })));
  });
}

/** Block / unblock a user from the community (likes, replies, votes, ratings, posts). */
router.post("/admin/users/:id/block", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const blocked = req.body?.blocked !== false;
  const [u] = await db.update(usersTable).set({ blocked }).where(eq(usersTable.id, id)).returning({ id: usersTable.id, role: usersTable.role, displayName: usersTable.displayName });
  if (!u) { res.status(404).json({ error: "User not found" }); return; }
  if (u.role === "admin") { await db.update(usersTable).set({ blocked: false }).where(eq(usersTable.id, id)); res.status(400).json({ error: "Admins can't be blocked" }); return; }
  await audit(req.user!.id, blocked ? "user.block" : "user.unblock", "user", id, { name: u.displayName });
  res.json({ ok: true, blocked });
});

export default router;
