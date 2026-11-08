import { isDisposableEmail } from "../lib/trust";
import crypto from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, isNull, gt, sql } from "drizzle-orm";
import { db, usersTable, otpCodesTable, creatorsTable } from "@workspace/db";
import { config, isProd } from "../lib/config";
import { createSessionToken, publicUser, requireAuth } from "../lib/auth";
import { mailEnabled, sendOtpEmail } from "../lib/mailer";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const hashOtp = (email: string, code: string) =>
  crypto.createHash("sha256").update(`${email}:${code}:${config.sessionSecret}`).digest("hex");

/** Very small in-memory limiter: N hits per window per key. Good enough for one server. */
const hits = new Map<string, number[]>();
function tooMany(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
const ipOf = (req: Request) => (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || "unknown";

function initialsAvatar(name: string) {
  const letter = (name.trim()[0] ?? "S").toUpperCase().replace(/[<>&"']/g, "S");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2a2420"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Georgia,serif" font-size="30" fill="#E1191F">${letter}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function uniqueUsername(base: string) {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "reader";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? clean : `${clean}${crypto.randomInt(100, 9999)}`;
    const [taken] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, candidate));
    if (!taken) return candidate;
  }
  return `${clean}${Date.now()}`;
}

const NEW_ACCOUNTS_PER_IP_PER_DAY = Number(process.env.NEW_ACCOUNTS_PER_IP_PER_DAY ?? 5);
class SignupLimitError extends Error { constructor() { super("Too many new accounts from this network today. Please try again tomorrow."); } }

async function findOrCreateUser(email: string, extra: { name?: string; picture?: string; googleId?: string; ref?: string; ip?: string } = {}) {
  email = email.toLowerCase();
  const isAdmin = config.adminEmails.includes(email);

  let [user] = extra.googleId
    ? await db.select().from(usersTable).where(eq(usersTable.googleId, extra.googleId))
    : [];
  if (!user) [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (user) {
    const patch: Partial<typeof usersTable.$inferInsert> = {};
    if (extra.googleId && !user.googleId) patch.googleId = extra.googleId;
    if (extra.picture && user.avatar.startsWith("data:")) patch.avatar = extra.picture;
    if (isAdmin && user.role !== "admin") patch.role = "admin";
    if (extra.ip && extra.ip !== user.lastIp) patch.lastIp = extra.ip;
    if (Object.keys(patch).length) [user] = await db.update(usersTable).set(patch).where(eq(usersTable.id, user.id)).returning();
    return user;
  }

  // Fake-account guard: at most a few new accounts per network per day.
  if (extra.ip && !isAdmin) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(usersTable)
      .where(and(eq(usersTable.lastIp, extra.ip), sql`${usersTable.joinedAt} > now() - interval '24 hours'`));
    if (n >= NEW_ACCOUNTS_PER_IP_PER_DAY) throw new SignupLimitError();
  }

  const displayName = extra.name || email.split("@")[0];
  let referredBy: number | null = null;
  if (extra.ref) {
    const [c] = await db.select({ id: creatorsTable.id }).from(creatorsTable).where(and(eq(creatorsTable.referralCode, extra.ref.slice(0, 40)), eq(creatorsTable.status, "approved")));
    referredBy = c?.id ?? null;
  }
  [user] = await db.insert(usersTable).values({
    email,
    googleId: extra.googleId ?? null,
    username: await uniqueUsername(email.split("@")[0]),
    displayName,
    avatar: extra.picture || initialsAvatar(displayName),
    role: isAdmin ? "admin" : "reader",
    referredBy,
    lastIp: extra.ip ?? null,
  }).returning();
  return user;
}

/* ---------- Email OTP ---------- */

router.post("/auth/otp/request", async (req, res): Promise<void> => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "Please enter a valid email address" }); return; }
  if (isDisposableEmail(email)) { res.status(400).json({ error: "Temporary email addresses aren't allowed. Please use your real email or Google login." }); return; }
  if (!mailEnabled && isProd) { res.status(503).json({ error: "Email login is not set up yet. Please use Google login." }); return; }
  if (tooMany(`otp-ip:${ipOf(req)}`, Number(process.env.OTP_IP_LIMIT ?? 10), 10 * 60 * 1000)) { res.status(429).json({ error: "Too many requests. Try again in a few minutes." }); return; }

  const [last] = await db.select().from(otpCodesTable).where(eq(otpCodesTable.email, email)).orderBy(desc(otpCodesTable.createdAt)).limit(1);
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_MS) {
    res.status(429).json({ error: "Please wait a minute before requesting another code" });
    return;
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(otpCodesTable).values({ email, codeHash: hashOtp(email, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });

  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    req.log.error({ err }, "failed to send OTP email");
    res.status(502).json({ error: "Could not send the email. Please try again." });
    return;
  }

  // Without SMTP configured (local dev only) the code is returned so you can test the flow.
  res.json({ ok: true, ...(!mailEnabled && !isProd ? { devCode: code } : {}) });
});

router.post("/auth/otp/verify", async (req, res): Promise<void> => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) { res.status(400).json({ error: "Enter the 6-digit code" }); return; }

  const [otp] = await db.select().from(otpCodesTable)
    .where(and(eq(otpCodesTable.email, email), isNull(otpCodesTable.consumedAt), gt(otpCodesTable.expiresAt, new Date())))
    .orderBy(desc(otpCodesTable.createdAt)).limit(1);

  if (!otp) { res.status(400).json({ error: "Code expired. Please request a new one." }); return; }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) { res.status(400).json({ error: "Too many wrong attempts. Request a new code." }); return; }

  const ok = crypto.timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hashOtp(email, code)));
  if (!ok) {
    await db.update(otpCodesTable).set({ attempts: otp.attempts + 1 }).where(eq(otpCodesTable.id, otp.id));
    res.status(400).json({ error: `Wrong code. ${OTP_MAX_ATTEMPTS - otp.attempts - 1} attempts left.` });
    return;
  }
  await db.update(otpCodesTable).set({ consumedAt: new Date() }).where(eq(otpCodesTable.id, otp.id));

  let user;
  try { user = await findOrCreateUser(email, { ref: typeof req.body?.ref === "string" ? req.body.ref : undefined, ip: ipOf(req) }); }
  catch (e) { if (e instanceof SignupLimitError) { res.status(429).json({ error: e.message }); return; } throw e; }
  res.json({ token: createSessionToken(user.id), user: publicUser(user) });
});

/* ---------- Google Sign-In ---------- */

router.post("/auth/google", async (req, res): Promise<void> => {
  const credential = String(req.body?.credential ?? "");
  if (!config.googleClientId) { res.status(503).json({ error: "Google login is not configured" }); return; }
  if (!credential) { res.status(400).json({ error: "Missing Google credential" }); return; }

  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!r.ok) { res.status(401).json({ error: "Google login failed" }); return; }
  const info = await r.json() as { aud?: string; iss?: string; email?: string; email_verified?: string | boolean; sub?: string; name?: string; picture?: string; exp?: string };

  const issOk = info.iss === "accounts.google.com" || info.iss === "https://accounts.google.com";
  const verified = info.email_verified === true || info.email_verified === "true";
  if (info.aud !== config.googleClientId || !issOk || !verified || !info.email || !info.sub) {
    res.status(401).json({ error: "Google login failed" });
    return;
  }

  let user;
  try { user = await findOrCreateUser(info.email, { name: info.name, picture: info.picture, googleId: info.sub, ref: typeof req.body?.ref === "string" ? req.body.ref : undefined, ip: ipOf(req) }); }
  catch (e) { if (e instanceof SignupLimitError) { res.status(429).json({ error: e.message }); return; } throw e; }
  res.json({ token: createSessionToken(user.id), user: publicUser(user) });
});

/* ---------- Current user ---------- */

router.get("/auth/config", (_req, res) => {
  res.json({ googleClientId: config.googleClientId || null, emailOtp: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const u = req.user!;
  const [creator] = u.creatorId ? await db.select().from(creatorsTable).where(eq(creatorsTable.id, u.creatorId)) : [];
  res.json({
    ...publicUser(u),
    creator: creator ? {
      id: creator.id, name: creator.name, type: creator.type, status: creator.status, studioName: creator.studioName, bio: creator.bio,
      avatar: creator.avatar, banner: creator.banner, city: creator.city, state: creator.state, isVerified: creator.isVerified,
      instagramUrl: creator.instagramUrl, twitterUrl: creator.twitterUrl, youtubeUrl: creator.youtubeUrl, websiteUrl: creator.websiteUrl,
    } : null,
  });
});

router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 60) : undefined;
  const bio = typeof req.body?.bio === "string" ? req.body.bio.trim().slice(0, 300) : undefined;
  const [u] = await db.update(usersTable)
    .set({ ...(displayName ? { displayName } : {}), ...(bio !== undefined ? { bio } : {}) })
    .where(eq(usersTable.id, req.user!.id)).returning();
  res.json(publicUser(u));
});

/** Update my creator / studio profile. Becoming a creator happens only through the application (routes/pro.ts). */
router.post("/creators/me", requireAuth, async (req, res): Promise<void> => {
  const u = req.user!;
  if (!u.creatorId) { res.status(400).json({ error: "Apply for a Professional Account in Settings first" }); return; }
  const b = req.body ?? {};
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  const url = (v: unknown) => (v === "" ? null : typeof v === "string" && /^https?:\/\//.test(v.trim()) ? v.trim().slice(0, 500) : undefined);
  const patch: Partial<typeof creatorsTable.$inferInsert> = {};
  const name = str(b.name, 60);
  if (name !== undefined) { if (name.length < 2) { res.status(400).json({ error: "Name is too short" }); return; } patch.name = name; }
  for (const [key, max] of [["studioName", 60], ["bio", 1500], ["city", 60], ["state", 60]] as const) {
    const v = str(b[key], max); if (v !== undefined) (patch as Record<string, unknown>)[key] = v || null;
  }
  for (const [key, col] of [["avatar", "avatar"], ["banner", "banner"], ["instagramUrl", "instagramUrl"], ["twitterUrl", "twitterUrl"], ["youtubeUrl", "youtubeUrl"], ["websiteUrl", "websiteUrl"]] as const) {
    const v = url(b[key]);
    if (v === undefined) continue;
    if (key === "avatar" && v === null) continue; // avatar can't be empty
    (patch as Record<string, unknown>)[col] = v;
  }
  const upi = str(b.upiId, 80);
  if (upi !== undefined) {
    if (upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) { res.status(400).json({ error: "UPI ID looks invalid (example: name@okaxis)" }); return; }
    patch.upiId = upi || null;
  }
  const payoutName = str(b.payoutName, 80); if (payoutName !== undefined) patch.payoutName = payoutName || null;
  const [c] = await db.update(creatorsTable).set(patch).where(eq(creatorsTable.id, u.creatorId)).returning();
  res.json(c);
});

export default router;
