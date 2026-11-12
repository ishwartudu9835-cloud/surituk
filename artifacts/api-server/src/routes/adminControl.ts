import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  db, usersTable, creatorsTable, mangaTable, chaptersTable, communityPostsTable, communityRepliesTable,
  reportsTable, notificationsTable, accountDeletionsTable, ownershipTransfersTable, teamMembersTable, creatorApplicationsTable, readingHistoryTable, bookmarksTable, genresTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import { audit, getSetting, setSetting } from "../lib/creatorProgram";
import { storageSelfTest } from "../lib/storage";
import { deleteStory, runAccountDeletion, runCreatorDeletion } from "../lib/deletion";
import { blockedTitles } from "../lib/piracy";

/**
 * Admin control centre: dashboard, users, stories, community, reports, notices, site settings.
 * Every change is written to the audit log.
 */
const router: IRouter = Router();
const n = sql<number>`count(*)::int`;
const num = (v: unknown) => parseInt(String(Array.isArray(v) ? v[0] : v), 10);
const like = (s: string) => `%${s.trim().slice(0, 80).replace(/[\\%_]/g, m => "\\" + m)}%`;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
async function count(q: Promise<{ n: number }[]>) { return (await q)[0]?.n ?? 0; }

async function notice(userIds: number[], message: string) {
  const ids = [...new Set(userIds)].filter(Boolean);
  for (let i = 0; i < ids.length; i += 500) {
    await db.insert(notificationsTable).values(ids.slice(i, i + 500).map(userId => ({ userId, type: "notice", message })));
  }
  return ids.length;
}

/* ---------------- Dashboard ---------------- */

router.get("/admin/dashboard", requireAdmin, async (_req, res): Promise<void> => {
  const day = sql`now() - interval '1 day'`, week = sql`now() - interval '7 days'`;
  const [users, usersToday, usersWeek, restricted, banned] = await Promise.all([
    count(db.select({ n }).from(usersTable)),
    count(db.select({ n }).from(usersTable).where(sql`${usersTable.joinedAt} > ${day}`)),
    count(db.select({ n }).from(usersTable).where(sql`${usersTable.joinedAt} > ${week}`)),
    count(db.select({ n }).from(usersTable).where(eq(usersTable.blocked, true))),
    count(db.select({ n }).from(usersTable).where(eq(usersTable.banned, true))),
  ]);
  const [creators, suspended, pendingApps, stories, hiddenStories, drafts, chapters] = await Promise.all([
    count(db.select({ n }).from(creatorsTable).where(eq(creatorsTable.status, "approved"))),
    count(db.select({ n }).from(creatorsTable).where(inArray(creatorsTable.status, ["suspended", "banned"]))),
    count(db.select({ n }).from(creatorApplicationsTable).where(eq(creatorApplicationsTable.status, "pending"))),
    count(db.select({ n }).from(mangaTable).where(and(eq(mangaTable.isPublished, true), eq(mangaTable.adminHidden, false)))),
    count(db.select({ n }).from(mangaTable).where(eq(mangaTable.adminHidden, true))),
    count(db.select({ n }).from(mangaTable).where(eq(mangaTable.isPublished, false))),
    count(db.select({ n }).from(chaptersTable)),
  ]);
  const chaptersToReview = await count(db.select({ n }).from(chaptersTable).where(eq(chaptersTable.needsReview, true)));
  const transfersPending = await count(db.select({ n }).from(ownershipTransfersTable).where(eq(ownershipTransfersTable.status, "pending")));
  const deletionsScheduled = await count(db.select({ n }).from(accountDeletionsTable).where(eq(accountDeletionsTable.status, "scheduled")));
  const [openReports, copyrightReports, posts, commentsToday] = await Promise.all([
    count(db.select({ n }).from(reportsTable).where(eq(reportsTable.status, "open"))),
    count(db.select({ n }).from(reportsTable).where(and(eq(reportsTable.status, "open"), eq(reportsTable.reason, "copyright")))),
    count(db.select({ n }).from(communityPostsTable)),
    count(db.select({ n }).from(communityRepliesTable).where(sql`${communityRepliesTable.createdAt} > ${day}`)),
  ]);
  const recentUsers = await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username, email: usersTable.email, avatar: usersTable.avatar, joinedAt: usersTable.joinedAt })
    .from(usersTable).orderBy(desc(usersTable.joinedAt)).limit(6);
  const signupsByDay = await db.execute(sql`
    select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(c.n, 0)::int as n
    from generate_series(current_date - 13, current_date, interval '1 day') d
    left join (select joined_at::date as day, count(*) as n from users where joined_at > current_date - 14 group by 1) c on c.day = d::date
    order by 1`);
  res.json({
    users: { total: users, today: usersToday, week: usersWeek, restricted, banned },
    creators: { approved: creators, suspended, pendingApplications: pendingApps },
    content: { stories, hiddenStories, drafts, chapters, posts, commentsToday },
    reports: { open: openReports, copyright: copyrightReports },
    deletions: { scheduled: deletionsScheduled },
    review: { chapters: chaptersToReview, transfers: transfersPending },
    signupsByDay: (signupsByDay as unknown as { rows: { day: string; n: number }[] }).rows ?? signupsByDay,
    recentUsers: recentUsers.map(u => ({ ...u, joinedAt: iso(u.joinedAt) })),
    storage: await storageSelfTest(),
    settings: {
      newCreatorMode: await getSetting("new_creator_mode", "manual"),
      signupsOpen: (await getSetting("signups_open", "true")) === "true",
      siteBanner: await getSetting("site_banner", ""),
      grievanceName: await getSetting("grievance_name", ""),
      grievanceEmail: await getSetting("grievance_email", ""),
      blockedTitles: (await blockedTitles()).join("\n"),
    },
  });
});

/* ---------------- Users ---------------- */

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const filter = String(req.query.filter ?? "all");
  const page = Math.max(0, num(req.query.page) || 0);
  const conds: SQL[] = [];
  if (q) conds.push(or(ilike(usersTable.email, like(q)), ilike(usersTable.displayName, like(q)), ilike(usersTable.username, like(q)))!);
  if (filter === "new") conds.push(sql`${usersTable.joinedAt} > now() - interval '7 days'`);
  if (filter === "restricted") conds.push(eq(usersTable.blocked, true));
  if (filter === "banned") conds.push(eq(usersTable.banned, true));
  if (filter === "creators") conds.push(sql`${usersTable.creatorId} is not null`);
  if (filter === "admins") conds.push(eq(usersTable.role, "admin"));
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select({
    id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username, email: usersTable.email, avatar: usersTable.avatar,
    role: usersTable.role, creatorId: usersTable.creatorId, onboarded: usersTable.onboarded, blocked: usersTable.blocked, banned: usersTable.banned,
    joinedAt: usersTable.joinedAt, points: usersTable.points,
  }).from(usersTable).where(where).orderBy(desc(usersTable.joinedAt)).limit(50).offset(page * 50);
  const total = await count(db.select({ n }).from(usersTable).where(where));
  res.json({ total, page, users: rows.map(r => ({ ...r, joinedAt: iso(r.joinedAt) })) });
});

router.get("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!u) { res.status(404).json({ error: "User not found" }); return; }
  const [creator] = u.creatorId ? await db.select().from(creatorsTable).where(eq(creatorsTable.id, u.creatorId)) : [];
  const comments = await db.select({ id: communityRepliesTable.id, content: communityRepliesTable.content, postId: communityRepliesTable.postId, createdAt: communityRepliesTable.createdAt })
    .from(communityRepliesTable).where(eq(communityRepliesTable.authorId, id)).orderBy(desc(communityRepliesTable.createdAt)).limit(20);
  const reportsAgainst = await count(db.select({ n }).from(reportsTable).where(or(
    and(eq(reportsTable.targetType, "user"), eq(reportsTable.targetId, id)),
    ...(u.creatorId ? [and(eq(reportsTable.targetType, "creator"), eq(reportsTable.targetId, u.creatorId))] : []),
  )));
  const reportsMade = await count(db.select({ n }).from(reportsTable).where(eq(reportsTable.reporterId, id)));
  const owned = await db.select({ id: creatorsTable.id, name: creatorsTable.name, type: creatorsTable.type, totalManga: creatorsTable.totalManga })
    .from(creatorsTable).where(and(eq(creatorsTable.ownerUserId, id), sql`${creatorsTable.status} <> 'deleted'`));
  res.json({
    ownedCreators: owned, deletedAt: iso(u.deletedAt),
    id: u.id, displayName: u.displayName, username: u.username, email: u.email, avatar: u.avatar, bio: u.bio, role: u.role,
    isAdult: u.isAdult, onboarded: u.onboarded,
    blocked: u.blocked, banned: u.banned, banReason: u.banReason, points: u.points, joinedAt: iso(u.joinedAt),
    creator: creator ? { id: creator.id, name: creator.name, slug: creator.slug, status: creator.status, strikes: creator.strikes, isVerified: creator.isVerified, totalManga: creator.totalManga, followers: creator.followers } : null,
    comments: comments.map(c => ({ ...c, createdAt: iso(c.createdAt) })),
    reportsAgainst, reportsMade,
  });
});

/** Delete one creator ID / studio right now: its stories, chapters, posts, team and subscribers. The owner stays a reader. */
router.post("/admin/creators/:id/delete", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const reason = String(req.body?.reason ?? "").trim().slice(0, 500);
  if (reason.length < 3) { res.status(400).json({ error: "Write a reason" }); return; }
  const [c] = await db.select().from(creatorsTable).where(eq(creatorsTable.id, id));
  if (!c || c.status === "deleted") { res.status(404).json({ error: "Creator not found" }); return; }
  await audit(req.user!.id, "creator.delete", "creator", id, { name: c.name, reason });
  await runCreatorDeletion(id, reason, req.user!.id, true);
  res.json({ ok: true });
});

router.post("/admin/users/:id/action", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const action = String(req.body?.action ?? "");
  const reason = String(req.body?.reason ?? "").trim().slice(0, 500);
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!u) { res.status(404).json({ error: "User not found" }); return; }
  const self = req.user!.id === id;
  if (self && ["restrict", "ban", "remove_admin", "delete_account"].includes(action)) { res.status(400).json({ error: "You can't do that to your own account" }); return; }
  if (u.deletedAt) { res.status(400).json({ error: "This account is already deleted" }); return; }
  if (u.role === "admin" && ["restrict", "ban", "delete_account"].includes(action)) { res.status(400).json({ error: "Remove admin rights first" }); return; }

  switch (action) {
    case "restrict":
      await db.update(usersTable).set({ blocked: true }).where(eq(usersTable.id, id));
      await notice([id], `Your account can no longer comment, like, vote or rate.${reason ? ` Reason: ${reason}` : ""}`);
      break;
    case "unrestrict":
      await db.update(usersTable).set({ blocked: false }).where(eq(usersTable.id, id));
      await notice([id], "Your community access has been restored.");
      break;
    case "ban":
      await db.update(usersTable).set({ banned: true, blocked: true, banReason: reason || null }).where(eq(usersTable.id, id));
      if (u.creatorId) await db.update(creatorsTable).set({ status: "banned" }).where(eq(creatorsTable.id, u.creatorId));
      break;
    case "unban":
      await db.update(usersTable).set({ banned: false, blocked: false, banReason: null }).where(eq(usersTable.id, id));
      break;
    case "make_admin":
      await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, id));
      break;
    case "remove_admin":
      await db.update(usersTable).set({ role: "reader" }).where(eq(usersTable.id, id));
      break;
    case "delete_account": {
      // Kick off the platform: account, every creator ID / studio they own, stories, posts and replies are deleted now.
      if (reason.length < 3) { res.status(400).json({ error: "Write a reason" }); return; }
      await audit(req.user!.id, "user.delete_account", "user", id, { name: u.displayName, email: u.email, reason });
      await runAccountDeletion(id, reason, { terminatedBy: req.user!.id });
      res.json({ ok: true }); return;
    }
    case "delete_comments": {
      const posts = await db.select({ postId: communityRepliesTable.postId, c: n }).from(communityRepliesTable).where(eq(communityRepliesTable.authorId, id)).groupBy(communityRepliesTable.postId);
      await db.delete(communityRepliesTable).where(eq(communityRepliesTable.authorId, id));
      for (const p of posts) await db.update(communityPostsTable).set({ replies: sql`greatest(${communityPostsTable.replies} - ${p.c}, 0)` }).where(eq(communityPostsTable.id, p.postId));
      break;
    }
    default:
      res.status(400).json({ error: "Unknown action" }); return;
  }
  await audit(req.user!.id, `user.${action}`, "user", id, { name: u.displayName, email: u.email, reason });
  res.json({ ok: true });
});

/* ---------------- Creators: strikes ---------------- */

router.post("/admin/creators/:id/strike", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const reason = String(req.body?.reason ?? "").trim().slice(0, 500);
  if (!reason) { res.status(400).json({ error: "Write the reason for the strike" }); return; }
  const [c] = await db.update(creatorsTable).set({ strikes: sql`${creatorsTable.strikes} + 1` }).where(eq(creatorsTable.id, id)).returning();
  if (!c) { res.status(404).json({ error: "Creator not found" }); return; }
  let suspended = false;
  if (c.strikes >= 3 && c.status === "approved") {
    await db.update(creatorsTable).set({ status: "suspended" }).where(eq(creatorsTable.id, id));
    suspended = true;
  }
  if (c.ownerUserId) {
    await notice([c.ownerUserId], `Strike ${c.strikes} of 3 on your creator account: ${reason.replace(/[.!]?$/, ".")}${suspended ? " Your account is now suspended." : " At 3 strikes the account is suspended."}`);
  }
  await audit(req.user!.id, "creator.strike", "creator", id, { name: c.name, reason, strikes: c.strikes, suspended });
  res.json({ ok: true, strikes: c.strikes, suspended });
});

router.post("/admin/creators/:id/clear-strikes", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const [c] = await db.update(creatorsTable).set({ strikes: 0 }).where(eq(creatorsTable.id, id)).returning({ name: creatorsTable.name });
  if (!c) { res.status(404).json({ error: "Creator not found" }); return; }
  await audit(req.user!.id, "creator.clear_strikes", "creator", id, { name: c.name });
  res.json({ ok: true });
});

/* ---------------- Stories ---------------- */

router.get("/admin/stories", requireAdmin, async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const filter = String(req.query.filter ?? "all");
  const conds: SQL[] = [];
  if (q) conds.push(or(ilike(mangaTable.title, like(q)), ilike(creatorsTable.name, like(q)))!);
  if (filter === "published") conds.push(and(eq(mangaTable.isPublished, true), eq(mangaTable.adminHidden, false))!);
  if (filter === "drafts") conds.push(eq(mangaTable.isPublished, false));
  if (filter === "unlisted") conds.push(eq(mangaTable.adminHidden, true));
  if (filter === "mature") conds.push(eq(mangaTable.isMature, true));
  if (filter === "featured") conds.push(eq(mangaTable.isFeatured, true));
  if (filter === "reported") conds.push(sql`exists (select 1 from reports r where r.target_type = 'manga' and r.target_id = ${mangaTable.id} and r.status = 'open')`);
  const rows = await db.select({
    id: mangaTable.id, title: mangaTable.title, slug: mangaTable.slug, coverImage: mangaTable.coverImage, genre: mangaTable.genre,
    isPublished: mangaTable.isPublished, adminHidden: mangaTable.adminHidden, adminNote: mangaTable.adminNote, isMature: mangaTable.isMature,
    isFeatured: mangaTable.isFeatured, views: mangaTable.views, rating: mangaTable.rating, ratingCount: mangaTable.ratingCount,
    creatorId: mangaTable.creatorId, creatorName: creatorsTable.name, updatedAt: mangaTable.updatedAt,
    chapters: sql<number>`(select count(*)::int from chapters c where c.manga_id = ${mangaTable.id})`,
    openReports: sql<number>`(select count(*)::int from reports r where r.target_type = 'manga' and r.target_id = ${mangaTable.id} and r.status = 'open')`,
  }).from(mangaTable).leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(conds.length ? and(...conds) : undefined).orderBy(desc(mangaTable.updatedAt)).limit(200);
  res.json(rows.map(r => ({ ...r, updatedAt: iso(r.updatedAt) })));
});

router.patch("/admin/stories/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const b = req.body ?? {};
  const patch: Partial<typeof mangaTable.$inferInsert> = {};
  if (typeof b.adminHidden === "boolean") patch.adminHidden = b.adminHidden;
  if (typeof b.isMature === "boolean") patch.isMature = b.isMature;
  if (typeof b.isFeatured === "boolean") patch.isFeatured = b.isFeatured;
  if (typeof b.adminNote === "string") patch.adminNote = b.adminNote.trim().slice(0, 500) || null;
  const [m] = await db.update(mangaTable).set(patch).where(eq(mangaTable.id, id)).returning();
  if (!m) { res.status(404).json({ error: "Story not found" }); return; }
  if (typeof b.adminHidden === "boolean") {
    const [c] = await db.select({ ownerUserId: creatorsTable.ownerUserId }).from(creatorsTable).where(eq(creatorsTable.id, m.creatorId));
    if (c?.ownerUserId) {
      await notice([c.ownerUserId], b.adminHidden
        ? `"${m.title}" has been unlisted by Surituk and is hidden from readers.${m.adminNote ? ` Reason: ${m.adminNote.replace(/[.!]?$/, ".")}` : ""} Contact support to appeal.`
        : `"${m.title}" is visible to readers again.`);
    }
  }
  await audit(req.user!.id, "story.update", "manga", id, { title: m.title, ...patch });
  res.json({ ok: true });
});

router.delete("/admin/stories/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const m = await deleteStory(id);
  if (!m) { res.status(404).json({ error: "Story not found" }); return; }
  const [c] = await db.select({ ownerUserId: creatorsTable.ownerUserId }).from(creatorsTable).where(eq(creatorsTable.id, m.creatorId));
  if (c?.ownerUserId) await notice([c.ownerUserId], `"${m.title}" was removed by Surituk for breaking the rules.`);
  await audit(req.user!.id, "story.delete", "manga", id, { title: m.title });
  res.json({ ok: true });
});

router.delete("/admin/chapters/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const [ch] = await db.delete(chaptersTable).where(eq(chaptersTable.id, id)).returning();
  if (!ch) { res.status(404).json({ error: "Chapter not found" }); return; }
  await db.update(mangaTable).set({ chapterCount: sql`greatest(${mangaTable.chapterCount} - 1, 0)` }).where(eq(mangaTable.id, ch.mangaId));
  await audit(req.user!.id, "chapter.delete", "chapter", id, { mangaId: ch.mangaId, number: ch.chapterNumber });
  res.json({ ok: true });
});

/* ---------------- Community ---------------- */

router.get("/admin/posts", requireAdmin, async (req, res): Promise<void> => {
  const filter = String(req.query.filter ?? "all");
  const conds: SQL[] = [];
  if (filter === "unlisted") conds.push(eq(communityPostsTable.hidden, true));
  if (filter === "reported") conds.push(sql`exists (select 1 from reports r where r.target_type = 'post' and r.target_id = ${communityPostsTable.id} and r.status = 'open')`);
  const rows = await db.select({
    id: communityPostsTable.id, type: communityPostsTable.type, title: communityPostsTable.title, content: communityPostsTable.content,
    images: communityPostsTable.images, hidden: communityPostsTable.hidden, likes: communityPostsTable.likes, replies: communityPostsTable.replies,
    createdAt: communityPostsTable.createdAt, authorId: communityPostsTable.authorId, authorName: sql<string>`coalesce(${creatorsTable.name}, ${usersTable.displayName})`,
    creatorId: communityPostsTable.creatorId,
    openReports: sql<number>`(select count(*)::int from reports r where r.target_type = 'post' and r.target_id = ${communityPostsTable.id} and r.status = 'open')`,
  }).from(communityPostsTable)
    .leftJoin(usersTable, eq(communityPostsTable.authorId, usersTable.id))
    .leftJoin(creatorsTable, eq(communityPostsTable.creatorId, creatorsTable.id))
    .where(conds.length ? and(...conds) : undefined).orderBy(desc(communityPostsTable.createdAt)).limit(200);
  res.json(rows.map(r => ({ ...r, createdAt: iso(r.createdAt) })));
});

router.patch("/admin/posts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const hidden = req.body?.hidden === true;
  const [p] = await db.update(communityPostsTable).set({ hidden }).where(eq(communityPostsTable.id, id)).returning();
  if (!p) { res.status(404).json({ error: "Post not found" }); return; }
  const reason = String(req.body?.reason ?? "").trim().slice(0, 300);
  if (hidden) await notice([p.authorId], `Your post "${p.title}" was unlisted by Surituk.${reason ? ` Reason: ${reason}` : ""}`);
  await audit(req.user!.id, hidden ? "post.unlist" : "post.restore", "post", id, { title: p.title, reason });
  res.json({ ok: true });
});

router.get("/admin/comments", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: communityRepliesTable.id, content: communityRepliesTable.content, postId: communityRepliesTable.postId, postTitle: communityPostsTable.title,
    authorId: communityRepliesTable.authorId, authorName: usersTable.displayName, authorEmail: usersTable.email, authorBlocked: usersTable.blocked,
    createdAt: communityRepliesTable.createdAt,
  }).from(communityRepliesTable)
    .leftJoin(usersTable, eq(communityRepliesTable.authorId, usersTable.id))
    .leftJoin(communityPostsTable, eq(communityRepliesTable.postId, communityPostsTable.id))
    .orderBy(desc(communityRepliesTable.createdAt)).limit(200);
  res.json(rows.map(r => ({ ...r, createdAt: iso(r.createdAt) })));
});

/* ---------------- Reports ---------------- */

async function describeTargets(rows: { targetType: string; targetId: number }[]) {
  const ids = (t: string) => [...new Set(rows.filter(r => r.targetType === t).map(r => r.targetId))];
  const out = new Map<string, { label: string; link: string | null; state: Record<string, unknown> }>();
  const set = (t: string, id: number, v: { label: string; link: string | null; state: Record<string, unknown> }) => out.set(`${t}:${id}`, v);
  const m = ids("manga"); if (m.length) for (const r of await db.select({ id: mangaTable.id, title: mangaTable.title, slug: mangaTable.slug, adminHidden: mangaTable.adminHidden, creatorId: mangaTable.creatorId, creatorName: creatorsTable.name }).from(mangaTable).leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id)).where(inArray(mangaTable.id, m)))
    set("manga", r.id, { label: `${r.title} — by ${r.creatorName ?? "?"}`, link: `/manga/${r.slug ?? r.id}`, state: { adminHidden: r.adminHidden, creatorId: r.creatorId } });
  const ch = ids("chapter"); if (ch.length) for (const r of await db.select({ id: chaptersTable.id, num: chaptersTable.chapterNumber, mangaId: chaptersTable.mangaId, title: mangaTable.title, slug: mangaTable.slug, creatorId: mangaTable.creatorId }).from(chaptersTable).leftJoin(mangaTable, eq(chaptersTable.mangaId, mangaTable.id)).where(inArray(chaptersTable.id, ch)))
    set("chapter", r.id, { label: `${r.title ?? "?"} — Chapter ${r.num}`, link: `/manga/${r.slug ?? r.mangaId}/chapter/${r.id}`, state: { mangaId: r.mangaId, creatorId: r.creatorId } });
  const p = ids("post"); if (p.length) for (const r of await db.select({ id: communityPostsTable.id, title: communityPostsTable.title, hidden: communityPostsTable.hidden, authorId: communityPostsTable.authorId, creatorId: communityPostsTable.creatorId }).from(communityPostsTable).where(inArray(communityPostsTable.id, p)))
    set("post", r.id, { label: `Post: ${r.title}`, link: "/community", state: { hidden: r.hidden, authorId: r.authorId, creatorId: r.creatorId } });
  const c = ids("comment"); if (c.length) for (const r of await db.select({ id: communityRepliesTable.id, content: communityRepliesTable.content, authorId: communityRepliesTable.authorId }).from(communityRepliesTable).where(inArray(communityRepliesTable.id, c)))
    set("comment", r.id, { label: `Comment: “${r.content.slice(0, 90)}”`, link: "/community", state: { authorId: r.authorId } });
  const cr = ids("creator"); if (cr.length) for (const r of await db.select({ id: creatorsTable.id, name: creatorsTable.name, slug: creatorsTable.slug, status: creatorsTable.status, strikes: creatorsTable.strikes, ownerUserId: creatorsTable.ownerUserId }).from(creatorsTable).where(inArray(creatorsTable.id, cr)))
    set("creator", r.id, { label: `Creator: ${r.name}`, link: `/creator/${r.slug ?? r.id}`, state: { status: r.status, strikes: r.strikes, creatorId: r.id, authorId: r.ownerUserId } });
  const u = ids("user"); if (u.length) for (const r of await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username, blocked: usersTable.blocked, banned: usersTable.banned }).from(usersTable).where(inArray(usersTable.id, u)))
    set("user", r.id, { label: `User: ${r.displayName} (@${r.username})`, link: `/u/${r.username}`, state: { blocked: r.blocked, banned: r.banned, authorId: r.id } });
  return out;
}

router.get("/admin/reports", requireAdmin, async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "open");
  const reason = String(req.query.reason ?? "all");
  const conds: SQL[] = [];
  if (status !== "all") conds.push(eq(reportsTable.status, status));
  if (reason !== "all") conds.push(eq(reportsTable.reason, reason));
  const rows = await db.select({ r: reportsTable, reporterName: usersTable.displayName, reporterEmail: usersTable.email })
    .from(reportsTable).leftJoin(usersTable, eq(reportsTable.reporterId, usersTable.id))
    .where(conds.length ? and(...conds) : undefined).orderBy(desc(reportsTable.createdAt)).limit(200);
  const targets = await describeTargets(rows.map(x => x.r));
  res.json(rows.map(({ r, reporterName, reporterEmail }) => ({
    ...r, createdAt: iso(r.createdAt), resolvedAt: iso(r.resolvedAt), reporterName, reporterEmail,
    target: targets.get(`${r.targetType}:${r.targetId}`) ?? { label: "Already deleted", link: null, state: {} },
  })));
});

router.post("/admin/reports/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["resolved", "dismissed", "open"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  const resolution = String(req.body?.resolution ?? "").trim().slice(0, 500) || null;
  const [r] = await db.update(reportsTable).set({ status, resolution, resolvedBy: req.user!.id, resolvedAt: status === "open" ? null : new Date() })
    .where(eq(reportsTable.id, id)).returning();
  if (!r) { res.status(404).json({ error: "Report not found" }); return; }
  if (r.reporterId && status === "resolved") await notice([r.reporterId], "Thanks for your report — we reviewed it and took action.");
  await audit(req.user!.id, `report.${status}`, "report", id, { reason: r.reason, target: `${r.targetType}:${r.targetId}`, resolution });
  res.json({ ok: true });
});

/* ---------------- Notices ---------------- */

router.post("/admin/notices", requireAdmin, async (req, res): Promise<void> => {
  const target = String(req.body?.target ?? "");
  const message = String(req.body?.message ?? "").trim().slice(0, 1000);
  if (message.length < 3) { res.status(400).json({ error: "Write the notice first" }); return; }
  let ids: number[] = [];
  if (target === "user") {
    const id = num(req.body?.userId);
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const [u] = id ? await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id))
      : email ? await db.select({ id: usersTable.id }).from(usersTable).where(or(eq(usersTable.email, email), eq(usersTable.username, email.replace(/^@/, "")))) : [];
    if (!u) { res.status(404).json({ error: "No user with that email or username" }); return; }
    ids = [u.id];
  } else if (target === "creator") {
    const [c] = await db.select({ ownerUserId: creatorsTable.ownerUserId }).from(creatorsTable).where(eq(creatorsTable.id, num(req.body?.creatorId)));
    if (!c?.ownerUserId) { res.status(404).json({ error: "Creator not found" }); return; }
    ids = [c.ownerUserId];
  } else if (target === "all_creators") {
    ids = (await db.select({ id: creatorsTable.ownerUserId }).from(creatorsTable).where(eq(creatorsTable.status, "approved"))).map(r => r.id!).filter(Boolean);
  } else if (target === "all_users") {
    ids = (await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.banned, false))).map(r => r.id);
  } else { res.status(400).json({ error: "Choose who gets the notice" }); return; }
  const sent = await notice(ids, `📢 ${message}`);
  await audit(req.user!.id, "notice.send", target, undefined, { message, sent });
  res.json({ ok: true, sent });
});

/* ---------------- Site settings ---------------- */

router.patch("/admin/site-settings", requireAdmin, async (req: Request, res): Promise<void> => {
  const b = req.body ?? {};
  const changed: Record<string, string> = {};
  if (b.newCreatorMode !== undefined) {
    if (!["manual", "auto"].includes(b.newCreatorMode)) { res.status(400).json({ error: "Mode must be manual or auto" }); return; }
    await setSetting("new_creator_mode", b.newCreatorMode); changed.newCreatorMode = b.newCreatorMode;
  }
  if (typeof b.signupsOpen === "boolean") { await setSetting("signups_open", String(b.signupsOpen)); changed.signupsOpen = String(b.signupsOpen); }
  if (typeof b.grievanceName === "string") { await setSetting("grievance_name", b.grievanceName.trim().slice(0, 120)); changed.grievanceName = b.grievanceName.trim(); }
  if (typeof b.grievanceEmail === "string") {
    const e = b.grievanceEmail.trim().slice(0, 200);
    if (e && !/^\S+@\S+\.\S+$/.test(e)) { res.status(400).json({ error: "Enter a valid grievance email" }); return; }
    await setSetting("grievance_email", e); changed.grievanceEmail = e;
  }
  if (typeof b.blockedTitles === "string") {
    const list = b.blockedTitles.split("\n").map((x: string) => x.trim().slice(0, 100)).filter(Boolean).slice(0, 2000);
    await setSetting("blocked_titles", list.join("\n")); changed.blockedTitles = `${list.length} titles`;
  }
  if (typeof b.siteBanner === "string") { await setSetting("site_banner", b.siteBanner.trim().slice(0, 300)); changed.siteBanner = b.siteBanner.trim().slice(0, 300); }
  await audit(req.user!.id, "settings.update", "setting", undefined, changed);
  res.json({ ok: true });
});

/* ---------------- First chapters from new creators ---------------- */

router.get("/admin/chapter-review", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: chaptersTable.id, title: chaptersTable.title, chapterNumber: chaptersTable.chapterNumber, pages: chaptersTable.pages, createdAt: chaptersTable.createdAt,
    mangaId: mangaTable.id, mangaTitle: mangaTable.title, mangaSlug: mangaTable.slug, adminHidden: mangaTable.adminHidden,
    creatorId: creatorsTable.id, creatorName: creatorsTable.name, creatorSlug: creatorsTable.slug,
  }).from(chaptersTable).innerJoin(mangaTable, eq(chaptersTable.mangaId, mangaTable.id)).innerJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(eq(chaptersTable.needsReview, true)).orderBy(desc(chaptersTable.createdAt)).limit(200);
  res.json(rows.map(r => ({ ...r, pages: (r.pages ?? []).slice(0, 6), pageCount: (r.pages ?? []).length, createdAt: iso(r.createdAt) })));
});

router.post("/admin/chapter-review/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const [ch] = await db.update(chaptersTable).set({ needsReview: false }).where(eq(chaptersTable.id, id)).returning({ mangaId: chaptersTable.mangaId });
  if (!ch) { res.status(404).json({ error: "Chapter not found" }); return; }
  await audit(req.user!.id, "chapter.review_ok", "chapter", id, {});
  res.json({ ok: true });
});

/* ---------------- Studio ownership transfers ---------------- */

router.get("/admin/transfers", requireAdmin, async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "pending");
  const rows = await db.select({
    id: ownershipTransfersTable.id, creatorId: ownershipTransfersTable.creatorId, note: ownershipTransfersTable.note, status: ownershipTransfersTable.status,
    createdAt: ownershipTransfersTable.createdAt, fromUserId: ownershipTransfersTable.fromUserId, toUserId: ownershipTransfersTable.toUserId,
    studio: creatorsTable.name,
  }).from(ownershipTransfersTable).leftJoin(creatorsTable, eq(ownershipTransfersTable.creatorId, creatorsTable.id))
    .where(status === "all" ? undefined : eq(ownershipTransfersTable.status, status)).orderBy(desc(ownershipTransfersTable.createdAt)).limit(100);
  const ids = [...new Set(rows.flatMap(r => [r.fromUserId, r.toUserId]))];
  const users = ids.length ? await db.select({ id: usersTable.id, displayName: usersTable.displayName, email: usersTable.email }).from(usersTable).where(inArray(usersTable.id, ids)) : [];
  const u = new Map(users.map(x => [x.id, x]));
  res.json(rows.map(r => ({ ...r, createdAt: iso(r.createdAt), from: u.get(r.fromUserId) ?? null, to: u.get(r.toUserId) ?? null })));
});

router.post("/admin/transfers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const approve = req.body?.approve === true;
  const [t] = await db.select().from(ownershipTransfersTable).where(and(eq(ownershipTransfersTable.id, id), eq(ownershipTransfersTable.status, "pending")));
  if (!t) { res.status(404).json({ error: "No pending transfer" }); return; }
  const [c] = await db.select({ name: creatorsTable.name }).from(creatorsTable).where(eq(creatorsTable.id, t.creatorId));
  if (approve) {
    const [{ owned }] = await db.select({ owned: n }).from(creatorsTable).where(and(eq(creatorsTable.ownerUserId, t.toUserId), eq(creatorsTable.type, "studio"), sql`${creatorsTable.status} not in ('deleted','pending')`));
    if (owned >= 3) { res.status(400).json({ error: "The new owner already owns 3 studios" }); return; }
    await db.update(creatorsTable).set({ ownerUserId: t.toUserId }).where(eq(creatorsTable.id, t.creatorId));
    await db.update(teamMembersTable).set({ access: "owner" }).where(and(eq(teamMembersTable.creatorId, t.creatorId), eq(teamMembersTable.userId, t.toUserId)));
    await db.update(teamMembersTable).set({ access: "manager", role: "editor" }).where(and(eq(teamMembersTable.creatorId, t.creatorId), eq(teamMembersTable.userId, t.fromUserId)));
    await notice([t.toUserId], `You're now the owner of ${c?.name}.`);
    await notice([t.fromUserId], `Ownership of ${c?.name} was transferred. You're now a manager there.`);
  } else {
    await notice([t.fromUserId], `The ownership transfer of ${c?.name} was not approved.${req.body?.reason ? ` Reason: ${String(req.body.reason).slice(0, 300)}` : ""}`);
  }
  await db.update(ownershipTransfersTable).set({ status: approve ? "approved" : "rejected", decidedAt: new Date() }).where(eq(ownershipTransfersTable.id, id));
  await audit(req.user!.id, approve ? "transfer.approve" : "transfer.reject", "creator", t.creatorId, { from: t.fromUserId, to: t.toUserId });
  res.json({ ok: true });
});

/* ---------------- Data export (safety copy) ---------------- */

function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(" | ") : v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\n");
}

/** Download a CSV copy: creators, stories, chapters (with page image links), posts or users. */
router.get("/admin/export/:what", requireAdmin, async (req, res): Promise<void> => {
  const what = String(req.params.what);
  let rows: Record<string, unknown>[] = [];
  if (what === "creators") rows = await db.select({ id: creatorsTable.id, name: creatorsTable.name, type: creatorsTable.type, status: creatorsTable.status, city: creatorsTable.city, state: creatorsTable.state, followers: creatorsTable.followers, stories: creatorsTable.totalManga, avatar: creatorsTable.avatar, banner: creatorsTable.banner, ownerEmail: usersTable.email, joinedAt: creatorsTable.joinedAt }).from(creatorsTable).leftJoin(usersTable, eq(creatorsTable.ownerUserId, usersTable.id));
  else if (what === "stories") rows = await db.select({ id: mangaTable.id, title: mangaTable.title, creator: creatorsTable.name, genre: mangaTable.genre, language: mangaTable.language, published: mangaTable.isPublished, unlisted: mangaTable.adminHidden, mature: mangaTable.isMature, views: mangaTable.views, likes: mangaTable.likes, rating: mangaTable.rating, cover: mangaTable.coverImage, banner: mangaTable.bannerImage, createdAt: mangaTable.createdAt }).from(mangaTable).leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id));
  else if (what === "chapters") rows = await db.select({ id: chaptersTable.id, story: mangaTable.title, creator: creatorsTable.name, number: chaptersTable.chapterNumber, title: chaptersTable.title, uploadedBy: usersTable.email, uploadedAt: chaptersTable.createdAt, pagesChangedAt: chaptersTable.pagesUpdatedAt, pages: chaptersTable.pages }).from(chaptersTable).leftJoin(mangaTable, eq(chaptersTable.mangaId, mangaTable.id)).leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id)).leftJoin(usersTable, eq(chaptersTable.uploadedBy, usersTable.id));
  else if (what === "posts") rows = await db.select({ id: communityPostsTable.id, type: communityPostsTable.type, title: communityPostsTable.title, content: communityPostsTable.content, images: communityPostsTable.images, creator: creatorsTable.name, likes: communityPostsTable.likes, comments: communityPostsTable.replies, hidden: communityPostsTable.hidden, createdAt: communityPostsTable.createdAt }).from(communityPostsTable).leftJoin(creatorsTable, eq(communityPostsTable.creatorId, creatorsTable.id));
  else if (what === "users") rows = await db.select({ id: usersTable.id, name: usersTable.displayName, username: usersTable.username, email: usersTable.email, role: usersTable.role, restricted: usersTable.blocked, banned: usersTable.banned, joinedAt: usersTable.joinedAt }).from(usersTable).where(sql`${usersTable.deletedAt} is null`);
  else { res.status(400).json({ error: "Unknown export" }); return; }
  await audit(req.user!.id, "export", what, undefined, { rows: rows.length });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="surituk-${what}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("\uFEFF" + csv(rows));
});

/** Public: banner shown at the top of every page (set by admins). */
router.get("/site-info", async (_req, res): Promise<void> => {
  res.json({
    banner: await getSetting("site_banner", ""),
    grievance: { name: await getSetting("grievance_name", ""), email: await getSetting("grievance_email", "") },
  });
});

export default router;
