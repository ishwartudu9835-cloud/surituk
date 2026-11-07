import { Router, type IRouter } from "express";
import { and, desc, eq, gt, gte, isNotNull, sql } from "drizzle-orm";
import {
  db, usersTable, creatorsTable, creatorApplicationsTable, teamMembersTable, creatorInvitesTable, readingHistoryTable,
} from "@workspace/db";
import { requireAuth, requireCreator } from "../lib/auth";
import { approveApplication, getSetting, notifyUser, verificationCodeFor, TEAM_ROLES } from "../lib/creatorProgram";
import { config } from "../lib/config";

/** Professional Account: apply for creator, track status, studio team invites, referrals. */
const router: IRouter = Router();

const REVIEW_DAYS = 7;
const isUrl = (v: unknown) => typeof v === "string" && /^https?:\/\/[^\s]+$/.test(v.trim()) && v.length < 500;
const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function dayOf(app: { createdAt: Date; updatedAt: Date; status: string }) {
  const from = app.status === "pending" ? app.updatedAt : app.createdAt;
  return Math.min(REVIEW_DAYS, Math.max(1, Math.ceil((Date.now() - from.getTime()) / 86_400_000)));
}

function appView(a: typeof creatorApplicationsTable.$inferSelect) {
  return {
    id: a.id, type: a.type, status: a.status, day: dayOf(a), reviewDays: REVIEW_DAYS,
    legalName: a.legalName, penName: a.penName, email: a.email, mobile: a.mobile, city: a.city, state: a.state,
    portfolioUrl: a.portfolioUrl, sampleImages: a.sampleImages, socialLinks: a.socialLinks,
    verificationCode: a.verificationCode, codeVerified: a.codeVerified,
    studioName: a.studioName, studioDescription: a.studioDescription, studioLogo: a.studioLogo, studioBanner: a.studioBanner,
    website: a.website, udyamNumber: a.udyamNumber, gstNumber: a.gstNumber, teamMembers: a.teamMembers,
    reviewNote: a.reviewNote, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
}

/** Validates the form. Returns an error string or clean values. */
function parseApplication(b: Record<string, any>, email: string) {
  const type = b.type === "studio" ? "studio" : b.type === "individual" ? "individual" : null;
  if (!type) return "Choose Individual Creator or Studio";
  const legalName = clean(b.legalName, 100);
  const penName = clean(b.penName, 60);
  const mobile = String(b.mobile ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const city = clean(b.city, 60), state = clean(b.state, 60);
  if (legalName.length < 3) return "Enter your full legal name";
  if (penName.length < 2) return "Enter your pen name / creator name";
  if (!/^[6-9]\d{9}$/.test(mobile)) return "Enter a valid 10-digit Indian mobile number";
  if (!city || !state) return "Enter your city and state";

  const sampleImages = Array.isArray(b.sampleImages) ? b.sampleImages.filter(isUrl).slice(0, 5) : [];
  const portfolioUrl = isUrl(b.portfolioUrl) ? String(b.portfolioUrl).trim() : null;
  if (sampleImages.length < 2 && !portfolioUrl) return "Upload 2–5 sample pages or add a portfolio link";

  const s = b.socialLinks ?? {};
  const socialLinks: Record<string, string> = {};
  for (const k of ["instagram", "x", "youtube", "website"]) if (isUrl(s[k])) socialLinks[k] = String(s[k]).trim();
  if (!Object.keys(socialLinks).length) return "Add at least one social media or website link";
  if (b.originalWorkAccepted !== true) return "Please confirm your work is original and accept the Terms";

  const base = { type, legalName, penName, email, mobile, city, state, sampleImages, portfolioUrl, socialLinks, originalWorkAccepted: true };
  if (type === "individual") return { ...base, studioName: null, studioDescription: null, studioLogo: null, studioBanner: null, website: null, udyamNumber: null, gstNumber: null, teamMembers: [] };

  const studioName = clean(b.studioName, 80);
  const studioDescription = clean(b.studioDescription, 1500);
  if (studioName.length < 2) return "Enter the studio name";
  if (studioDescription.length < 20) return "Write a short studio description (at least 20 characters)";
  const team = Array.isArray(b.teamMembers) ? b.teamMembers.slice(0, 20) : [];
  const teamMembers: { name: string; email: string; role: string }[] = [];
  for (const m of team) {
    const name = clean(m?.name, 80), em = clean(m?.email, 120).toLowerCase(), role = clean(m?.role, 20).toLowerCase();
    if (!name && !em) continue;
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return "Each team member needs a name and a valid email";
    if (!TEAM_ROLES.includes(role as never) || role === "owner") return "Team roles: Artist, Writer or Editor";
    teamMembers.push({ name, email: em, role });
  }
  const udyam = clean(b.udyamNumber, 30).toUpperCase() || null;
  const gst = clean(b.gstNumber, 20).toUpperCase() || null;
  if (udyam && !/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(udyam)) return "Udyam number format: UDYAM-XX-00-0000000";
  if (gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gst)) return "GST number looks invalid";
  return {
    ...base, studioName, studioDescription,
    studioLogo: isUrl(b.studioLogo) ? b.studioLogo : null, studioBanner: isUrl(b.studioBanner) ? b.studioBanner : null,
    website: isUrl(b.website) ? b.website : null, udyamNumber: udyam, gstNumber: gst, teamMembers,
  };
}

router.get("/pro/status", requireAuth, async (req, res): Promise<void> => {
  const u = req.user!;
  const [app] = await db.select().from(creatorApplicationsTable).where(eq(creatorApplicationsTable.userId, u.id)).orderBy(desc(creatorApplicationsTable.createdAt)).limit(1);
  const [creator] = u.creatorId ? await db.select().from(creatorsTable).where(eq(creatorsTable.id, u.creatorId)) : [];
  const [member] = await db.select({ role: teamMembersTable.role }).from(teamMembersTable).where(and(eq(teamMembersTable.userId, u.id), eq(teamMembersTable.status, "active"))).limit(1);
  res.json({
    verificationCode: verificationCodeFor(u.id),
    application: app ? appView(app) : null,
    creator: creator ? { id: creator.id, name: creator.name, type: creator.type, status: creator.status, isVerified: creator.isVerified, referralCode: creator.referralCode } : null,
    teamRole: member?.role ?? null,
  });
});

/** Admin invite link: validate token (to show "you'll be approved instantly"). */
router.get("/pro/invite/:token", async (req, res): Promise<void> => {
  const [inv] = await db.select().from(creatorInvitesTable).where(eq(creatorInvitesTable.token, String(req.params.token)));
  const valid = !!inv && inv.usesLeft > 0 && (!inv.expiresAt || inv.expiresAt > new Date());
  res.json({ valid });
});

router.post("/pro/apply", requireAuth, async (req, res): Promise<void> => {
  const u = req.user!;
  if (u.creatorId) {
    const [c] = await db.select({ status: creatorsTable.status }).from(creatorsTable).where(eq(creatorsTable.id, u.creatorId));
    if (c?.status === "approved") { res.status(400).json({ error: "You already have a creator account" }); return; }
    if (c?.status === "banned") { res.status(403).json({ error: "This account can't apply" }); return; }
  }
  const [open] = await db.select().from(creatorApplicationsTable)
    .where(and(eq(creatorApplicationsTable.userId, u.id), sql`${creatorApplicationsTable.status} in ('pending','more_info')`)).limit(1);
  if (open) { res.status(400).json({ error: "You already have an application under review" }); return; }
  if (!u.email) { res.status(400).json({ error: "Your account needs a verified email" }); return; }

  const v = parseApplication(req.body ?? {}, u.email);
  if (typeof v === "string") { res.status(400).json({ error: v }); return; }

  // Pending creator row so the applicant can prepare private drafts while waiting.
  let creatorId = u.creatorId;
  if (!creatorId) {
    const [c] = await db.insert(creatorsTable).values({
      name: v.type === "studio" ? v.studioName! : v.penName, type: v.type, status: "pending",
      avatar: (v.type === "studio" && v.studioLogo) || u.avatar, city: v.city, state: v.state, ownerUserId: u.id,
    }).returning();
    creatorId = c.id;
    await db.update(usersTable).set({ creatorId }).where(eq(usersTable.id, u.id));
  }

  const [app] = await db.insert(creatorApplicationsTable).values({
    ...v, userId: u.id, creatorId, verificationCode: verificationCodeFor(u.id),
    inviteToken: typeof req.body?.inviteToken === "string" ? req.body.inviteToken.slice(0, 80) : null,
  }).returning();

  // Instant approval: admin invite link, or Auto Approve mode.
  let instant = false;
  if (app.inviteToken) {
    const [inv] = await db.update(creatorInvitesTable).set({ usesLeft: sql`${creatorInvitesTable.usesLeft} - 1` })
      .where(and(eq(creatorInvitesTable.token, app.inviteToken), gt(creatorInvitesTable.usesLeft, 0), sql`(${creatorInvitesTable.expiresAt} is null or ${creatorInvitesTable.expiresAt} > now())`))
      .returning();
    instant = !!inv;
  }
  if (!instant && (await getSetting("new_creator_mode", "manual")) === "auto") instant = true;

  if (instant) {
    await approveApplication(app, null, "Approved automatically");
  } else {
    await notifyUser(u.id, `Your creator application was received. Review takes ${3}–${REVIEW_DAYS} days.`, {
      to: u.email, subject: "We received your Surituk creator application",
      title: "Application received", body: `<p>Thanks for applying, <b>${v.penName}</b>! Our team reviews applications in 3–${REVIEW_DAYS} days. Meanwhile you can prepare private drafts in Creator Studio.</p><p>Tip: put your code <b>${app.verificationCode}</b> in your social media bio so we can verify your account faster.</p>`,
      cta: { label: "Check status", url: `${config.frontendUrl}/settings?tab=pro` },
    });
  }
  const [fresh] = await db.select().from(creatorApplicationsTable).where(eq(creatorApplicationsTable.id, app.id));
  res.status(201).json({ application: appView(fresh), approved: instant });
});

/** Resubmit after "More info needed". */
router.patch("/pro/application", requireAuth, async (req, res): Promise<void> => {
  const u = req.user!;
  const [app] = await db.select().from(creatorApplicationsTable)
    .where(and(eq(creatorApplicationsTable.userId, u.id), sql`${creatorApplicationsTable.status} in ('pending','more_info')`))
    .orderBy(desc(creatorApplicationsTable.createdAt)).limit(1);
  if (!app) { res.status(404).json({ error: "No open application" }); return; }
  const v = parseApplication({ ...req.body, type: app.type }, u.email ?? app.email);
  if (typeof v === "string") { res.status(400).json({ error: v }); return; }
  const [fresh] = await db.update(creatorApplicationsTable).set({ ...v, status: "pending", updatedAt: new Date() })
    .where(eq(creatorApplicationsTable.id, app.id)).returning();
  res.json({ application: appView(fresh) });
});

/* ---------------- Studio team ---------------- */

router.get("/pro/team", requireCreator, async (req, res): Promise<void> => {
  const rows = await db.select().from(teamMembersTable).where(eq(teamMembersTable.creatorId, req.user!.creatorId!)).orderBy(teamMembersTable.createdAt);
  res.json(rows.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, status: r.status })));
});

router.post("/pro/team", requireCreator, async (req, res): Promise<void> => {
  const creatorId = req.user!.creatorId!;
  const [me] = await db.select({ role: teamMembersTable.role }).from(teamMembersTable).where(and(eq(teamMembersTable.creatorId, creatorId), eq(teamMembersTable.userId, req.user!.id)));
  const [c] = await db.select().from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  if (c?.type !== "studio" || (me?.role !== "owner" && c.ownerUserId !== req.user!.id)) { res.status(403).json({ error: "Only the studio owner can invite members" }); return; }
  if (c.status !== "approved") { res.status(400).json({ error: "Team invites are sent after your studio is approved" }); return; }
  const name = clean(req.body?.name, 80), email = clean(req.body?.email, 120).toLowerCase(), role = clean(req.body?.role, 20).toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !["artist", "writer", "editor"].includes(role)) { res.status(400).json({ error: "Name, valid email and role (Artist/Writer/Editor) are required" }); return; }
  const { inviteTeam } = await import("../lib/creatorProgram");
  await inviteTeam(creatorId, c.name, [{ name, email, role }], (req.user!.email ?? "").toLowerCase());
  res.status(201).json({ ok: true });
});

router.delete("/pro/team/:id", requireCreator, async (req, res): Promise<void> => {
  const creatorId = req.user!.creatorId!;
  const [c] = await db.select().from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  if (c?.ownerUserId !== req.user!.id) { res.status(403).json({ error: "Only the studio owner can remove members" }); return; }
  const [m] = await db.delete(teamMembersTable).where(and(eq(teamMembersTable.id, Number(req.params.id)), eq(teamMembersTable.creatorId, creatorId), sql`${teamMembersTable.role} <> 'owner'`)).returning();
  if (m?.userId) await db.update(usersTable).set({ creatorId: null, role: "reader" }).where(and(eq(usersTable.id, m.userId), eq(usersTable.creatorId, creatorId), sql`${usersTable.role} <> 'admin'`));
  res.json({ ok: !!m });
});

router.get("/pro/team-invite/:token", async (req, res): Promise<void> => {
  const [m] = await db.select({ name: teamMembersTable.name, email: teamMembersTable.email, role: teamMembersTable.role, status: teamMembersTable.status, studio: creatorsTable.name, avatar: creatorsTable.avatar })
    .from(teamMembersTable).innerJoin(creatorsTable, eq(teamMembersTable.creatorId, creatorsTable.id)).where(eq(teamMembersTable.inviteToken, String(req.params.token)));
  if (!m) { res.status(404).json({ error: "This invite link is invalid or was already used" }); return; }
  res.json(m);
});

router.post("/pro/team-invite/:token/accept", requireAuth, async (req, res): Promise<void> => {
  const u = req.user!;
  const [m] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.inviteToken, String(req.params.token)));
  if (!m || m.status !== "invited") { res.status(404).json({ error: "This invite link is invalid or was already used" }); return; }
  if ((u.email ?? "").toLowerCase() !== m.email) { res.status(403).json({ error: `This invite is for ${m.email}. Log in with that email to accept.` }); return; }
  if (u.creatorId && u.creatorId !== m.creatorId) { res.status(400).json({ error: "You already belong to another creator account" }); return; }
  await db.update(teamMembersTable).set({ userId: u.id, status: "active", inviteToken: null }).where(eq(teamMembersTable.id, m.id));
  await db.update(usersTable).set({ creatorId: m.creatorId, role: u.role === "admin" ? "admin" : "creator" }).where(eq(usersTable.id, u.id));
  res.json({ ok: true });
});

/** Public: active members of a studio (shown on the studio page). */
router.get("/creators/:creatorId/team", async (req, res): Promise<void> => {
  const rows = await db.select({ name: teamMembersTable.name, role: teamMembersTable.role, avatar: usersTable.avatar, userId: teamMembersTable.userId })
    .from(teamMembersTable).leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(and(eq(teamMembersTable.creatorId, Number(req.params.creatorId)), eq(teamMembersTable.status, "active")))
    .orderBy(teamMembersTable.createdAt);
  res.json(rows);
});

/* ---------------- Referrals (optional) ---------------- */

router.get("/pro/referrals", requireCreator, async (req, res): Promise<void> => {
  const creatorId = req.user!.creatorId!;
  const [c] = await db.select({ code: creatorsTable.referralCode }).from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.referredBy, creatorId));
  // "Active" = signed up via your link and read something in the last 30 days.
  const [active] = await db.select({ n: sql<number>`count(distinct ${usersTable.id})::int` }).from(usersTable)
    .innerJoin(readingHistoryTable, eq(readingHistoryTable.userId, usersTable.id))
    .where(and(eq(usersTable.referredBy, creatorId), isNotNull(usersTable.email), gte(readingHistoryTable.lastReadAt, new Date(Date.now() - 30 * 86_400_000))));
  res.json({ code: c?.code ?? null, link: c?.code ? `${config.frontendUrl}/?ref=${c.code}` : null, total: total.n, active: active.n });
});

export default router;
