import { assignCreatorSlug } from "./slug";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  db, usersTable, creatorsTable, creatorApplicationsTable, teamMembersTable, appSettingsTable, adminAuditLogTable, notificationsTable,
  type CreatorApplication,
} from "@workspace/db";
import { config } from "./config";
import { sendMail } from "./mailer";
import { logger } from "./logger";

export const TEAM_ROLES = ["owner", "artist", "writer", "editor"] as const;

/** Stable per-user code they put in a social bio to prove the account is theirs. */
export function verificationCodeFor(userId: number) {
  const n = parseInt(crypto.createHmac("sha256", config.sessionSecret).update(`verify:${userId}`).digest("hex").slice(0, 8), 16) % 9000 + 1000;
  return `SURITUK-${n}`;
}

export async function getSetting(key: string, fallback: string) {
  const [r] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return r?.value ?? fallback;
}
export async function setSetting(key: string, value: string) {
  await db.insert(appSettingsTable).values({ key, value }).onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
}

export async function audit(adminUserId: number, action: string, targetType?: string, targetId?: number, details?: unknown) {
  try {
    await db.insert(adminAuditLogTable).values({ adminUserId, action, targetType: targetType ?? null, targetId: targetId ?? null, details: details ?? null });
  } catch (err) { logger.error({ err }, "audit log failed"); }
}

const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
function emailShell(title: string, body: string, cta?: { label: string; url: string }) {
  return `<div style="font-family:Arial,sans-serif;background:#0F0D0C;padding:32px;color:#F7EFE3">
    <div style="max-width:480px;margin:auto;background:#171412;border-radius:12px;padding:28px;border:1px solid #2a2420">
      <h2 style="margin:0 0 6px;font-family:Georgia,serif">Sur<span style="color:#E1191F">i</span>tuk</h2>
      <h3 style="margin:16px 0 8px">${esc(title)}</h3>
      <div style="color:#c9bfb3;line-height:1.6">${body}</div>
      ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#E1191F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">${esc(cta.label)}</a>` : ""}
    </div></div>`;
}

export async function notifyUser(userId: number, message: string, email?: { to: string; subject: string; title: string; body: string; cta?: { label: string; url: string } }) {
  await db.insert(notificationsTable).values({ userId, type: "system", message });
  if (email) {
    try { await sendMail(email.to, email.subject, emailShell(email.title, email.body, email.cta), `${email.title}\n\n${email.body.replace(/<[^>]+>/g, "")}${email.cta ? `\n\n${email.cta.url}` : ""}`); }
    catch (err) { logger.error({ err }, "email failed"); }
  }
}

async function uniqueReferralCode(base: string) {
  const clean = base.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "creator";
  for (let i = 0; i < 20; i++) {
    const code = `${clean}${crypto.randomInt(100, 9999)}`;
    const [t] = await db.select({ id: creatorsTable.id }).from(creatorsTable).where(eq(creatorsTable.referralCode, code));
    if (!t) return code;
  }
  return `${clean}${Date.now()}`;
}

/** Sends invites to studio team members (owner is the applicant). */
export async function inviteTeam(creatorId: number, studioName: string, members: { name: string; email: string; role: string }[], ownerEmail: string) {
  for (const m of members) {
    const email = m.email.trim().toLowerCase();
    if (!email || email === ownerEmail) continue;
    const [exists] = await db.select({ id: teamMembersTable.id }).from(teamMembersTable).where(and(eq(teamMembersTable.creatorId, creatorId), eq(teamMembersTable.email, email)));
    if (exists) continue;
    const token = crypto.randomBytes(18).toString("base64url");
    await db.insert(teamMembersTable).values({ creatorId, name: m.name.slice(0, 80), email, role: TEAM_ROLES.includes(m.role as never) ? m.role : "artist", inviteToken: token });
    try {
      const url = `${config.frontendUrl}/join/team/${token}`;
      await sendMail(email, `You're invited to join ${studioName} on Surituk`,
        emailShell(`Join ${studioName} on Surituk`, `<p>Hi ${esc(m.name)},</p><p>You've been added to the studio <b>${esc(studioName)}</b> as <b>${esc(m.role)}</b>. Log in with this email address to accept.</p>`, { label: "Accept invite", url }),
        `You've been invited to join ${studioName} on Surituk as ${m.role}. Accept: ${url}`);
    } catch (err) { logger.error({ err }, "team invite email failed"); }
  }
}

/** Approve: creator goes public-capable, user becomes creator, team gets invited, applicant notified. */
export async function approveApplication(app: CreatorApplication, adminUserId: number | null, note?: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, app.userId));
  if (!user) throw new Error("Applicant not found");
  const isStudio = app.type === "studio";
  const name = isStudio ? (app.studioName || app.penName) : app.penName;
  const socials = app.socialLinks ?? {};
  const values = {
    name,
    type: app.type,
    status: "approved",
    approvedAt: new Date(),
    studioName: isStudio ? app.studioName : null,
    bio: isStudio ? app.studioDescription : null,
    avatar: (isStudio && app.studioLogo) || user.avatar,
    banner: isStudio ? app.studioBanner : null,
    city: app.city,
    state: app.state,
    instagramUrl: socials.instagram || null,
    twitterUrl: socials.x || null,
    youtubeUrl: socials.youtube || null,
    websiteUrl: socials.website || app.website || null,
    ownerUserId: user.id,
  };
  let creatorId = app.creatorId ?? user.creatorId ?? null;
  if (creatorId) {
    const [c] = await db.select({ referralCode: creatorsTable.referralCode }).from(creatorsTable).where(eq(creatorsTable.id, creatorId));
    await db.update(creatorsTable).set({ ...values, referralCode: c?.referralCode ?? await uniqueReferralCode(name) }).where(eq(creatorsTable.id, creatorId));
  } else {
    const [c] = await db.insert(creatorsTable).values({ ...values, referralCode: await uniqueReferralCode(name) }).returning();
    c.slug = await assignCreatorSlug(c.id, c.name);
    creatorId = c.id;
  }
  await db.update(usersTable).set({ creatorId, role: user.role === "admin" ? "admin" : "creator" }).where(eq(usersTable.id, user.id));
  await db.update(creatorApplicationsTable).set({
    status: "approved", creatorId, reviewNote: note ?? app.reviewNote, reviewedBy: adminUserId, reviewedAt: new Date(), updatedAt: new Date(),
  }).where(eq(creatorApplicationsTable.id, app.id));

  if (isStudio) {
    const [owner] = await db.select({ id: teamMembersTable.id }).from(teamMembersTable).where(and(eq(teamMembersTable.creatorId, creatorId), eq(teamMembersTable.userId, user.id)));
    if (!owner) await db.insert(teamMembersTable).values({ creatorId, userId: user.id, name: app.legalName, email: (user.email ?? app.email).toLowerCase(), role: "owner", access: "owner", status: "active" });
    await inviteTeam(creatorId, name, app.teamMembers ?? [], (user.email ?? app.email).toLowerCase());
  }

  await notifyUser(user.id, `🎉 Your creator application was approved! Creator Studio is now open.`, {
    to: user.email ?? app.email, subject: "Your Surituk creator account is approved",
    title: "Welcome to Surituk Creators!", body: `<p>Your ${isStudio ? "studio" : "creator"} account <b>${esc(name)}</b> is approved. You can now publish your graphic novels.</p>`,
    cta: { label: "Open Creator Studio", url: `${config.frontendUrl}/creator-dashboard` },
  });
  return creatorId;
}
