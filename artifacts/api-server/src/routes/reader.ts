import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import {
  db, usersTable, mangaTable, chaptersTable, creatorsTable, readingHistoryTable, viewsDailyTable, genresTable,
} from "@workspace/db";
import { requireAuth, publicUser } from "../lib/auth";
import { visibleManga, canManage } from "../lib/visibility";

/** Reader features: profile settings, reading progress, Continue Reading, For You, views, leaderboards. */
const router: IRouter = Router();

const cardFields = {
  id: mangaTable.id,
  title: mangaTable.title,
  slug: mangaTable.slug,
  coverImage: mangaTable.coverImage,
  genre: mangaTable.genre,
  chapterCount: mangaTable.chapterCount,
  views: mangaTable.views,
  likes: mangaTable.likes,
  status: mangaTable.status,
  isMature: mangaTable.isMature,
  creatorId: mangaTable.creatorId,
  creatorName: creatorsTable.name,
  creatorSlug: creatorsTable.slug,
  creatorType: creatorsTable.type,
};

/* ---------------- Profile ---------------- */

router.patch("/me/profile", requireAuth, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const patch: Partial<typeof usersTable.$inferInsert> = {};
  if (b.displayName !== undefined) {
    const d = String(b.displayName).trim().slice(0, 60);
    if (d.length < 2) { res.status(400).json({ error: "Name is too short" }); return; }
    patch.displayName = d;
  }
  if (b.username !== undefined) {
    const u = String(b.username).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { res.status(400).json({ error: "Username: 3–20 letters, numbers or _" }); return; }
    const [taken] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, u));
    if (taken && taken.id !== req.user!.id) { res.status(400).json({ error: "That username is taken" }); return; }
    patch.username = u;
  }
  if (b.bio !== undefined) patch.bio = String(b.bio).trim().slice(0, 300) || null;
  if (typeof b.avatar === "string" && /^https?:\/\//.test(b.avatar)) patch.avatar = b.avatar.slice(0, 600);
  if (typeof b.isAdult === "boolean") patch.isAdult = b.isAdult;
  if (Array.isArray(b.favoriteGenres)) patch.favoriteGenres = b.favoriteGenres.map((g: unknown) => String(g).slice(0, 40)).slice(0, 10);
  if (b.uiLanguage === "en" || b.uiLanguage === "hi") patch.uiLanguage = b.uiLanguage;
  if (b.onboarded === true) patch.onboarded = true;
  const [u] = await db.update(usersTable).set(patch).where(eq(usersTable.id, req.user!.id)).returning();
  res.json(publicUser(u));
});

/* ---------------- Reading progress ---------------- */

router.post("/me/progress", requireAuth, async (req, res): Promise<void> => {
  const chapterId = Number(req.body?.chapterId);
  const page = Math.max(0, Math.floor(Number(req.body?.page) || 0));
  const totalPages = Math.max(1, Math.floor(Number(req.body?.totalPages) || 1));
  const [ch] = await db.select({ id: chaptersTable.id, mangaId: chaptersTable.mangaId, chapterNumber: chaptersTable.chapterNumber })
    .from(chaptersTable).where(eq(chaptersTable.id, chapterId));
  if (!ch) { res.status(404).json({ error: "Chapter not found" }); return; }

  // % of the whole series read = (chapters before this + fraction of this one) / total chapters
  const all = await db.select({ id: chaptersTable.id }).from(chaptersTable).where(eq(chaptersTable.mangaId, ch.mangaId)).orderBy(chaptersTable.chapterNumber);
  const idx = Math.max(0, all.findIndex(c => c.id === ch.id));
  const pageFrac = Math.min(1, (page + 1) / totalPages);
  const progress = Math.round(((idx + pageFrac) / Math.max(all.length, 1)) * 1000) / 10;
  const isCompleted = idx === all.length - 1 && pageFrac >= 1;

  const [existing] = await db.select().from(readingHistoryTable)
    .where(and(eq(readingHistoryTable.userId, req.user!.id), eq(readingHistoryTable.mangaId, ch.mangaId)));
  const values = { lastChapter: ch.chapterNumber, lastChapterId: ch.id, lastPage: page, progress, isCompleted, lastReadAt: new Date() };
  if (existing) await db.update(readingHistoryTable).set(values).where(eq(readingHistoryTable.id, existing.id));
  else await db.insert(readingHistoryTable).values({ userId: req.user!.id, mangaId: ch.mangaId, ...values });
  res.json({ ok: true, progress });
});

async function historyRows(userId: number, user: Express.Request["user"], onlyUnfinished: boolean, limit: number) {
  const conds = [eq(readingHistoryTable.userId, userId), visibleManga(user)];
  if (onlyUnfinished) conds.push(eq(readingHistoryTable.isCompleted, false));
  const rows = await db.select({
    ...cardFields,
    lastChapter: readingHistoryTable.lastChapter,
    lastChapterId: readingHistoryTable.lastChapterId,
    lastPage: readingHistoryTable.lastPage,
    progress: readingHistoryTable.progress,
    isCompleted: readingHistoryTable.isCompleted,
    lastReadAt: readingHistoryTable.lastReadAt,
  }).from(readingHistoryTable)
    .innerJoin(mangaTable, eq(readingHistoryTable.mangaId, mangaTable.id))
    .innerJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(and(...conds))
    .orderBy(desc(readingHistoryTable.lastReadAt))
    .limit(limit);
  return rows.map(r => ({ ...r, lastReadAt: r.lastReadAt.toISOString() }));
}

router.get("/me/continue-reading", requireAuth, async (req, res): Promise<void> => {
  res.json(await historyRows(req.user!.id, req.user, true, 12));
});

router.get("/me/history", requireAuth, async (req, res): Promise<void> => {
  res.json(await historyRows(req.user!.id, req.user, false, 100));
});

router.delete("/me/history/:mangaId", requireAuth, async (req, res): Promise<void> => {
  await db.delete(readingHistoryTable).where(and(eq(readingHistoryTable.userId, req.user!.id), eq(readingHistoryTable.mangaId, Number(req.params.mangaId))));
  res.json({ ok: true });
});

/* ---------------- For You ---------------- */

router.get("/me/recommendations", requireAuth, async (req, res): Promise<void> => {
  const u = req.user!;
  // Genre score: genres you read (weighted by how far you got) + genres you picked as favourites.
  const read = await db.select({ genre: mangaTable.genre, mangaId: mangaTable.id, progress: readingHistoryTable.progress })
    .from(readingHistoryTable).innerJoin(mangaTable, eq(readingHistoryTable.mangaId, mangaTable.id))
    .where(eq(readingHistoryTable.userId, u.id));
  const score = new Map<string, number>();
  for (const r of read) score.set(r.genre, (score.get(r.genre) ?? 0) + 1 + r.progress / 50);
  for (const g of u.favoriteGenres ?? []) score.set(g, (score.get(g) ?? 0) + 3);
  const topGenres = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);
  const readIds = read.map(r => r.mangaId);

  const conds = [visibleManga(u)];
  if (readIds.length) conds.push(notInArray(mangaTable.id, readIds));
  let rows = topGenres.length
    ? await db.select(cardFields).from(mangaTable).innerJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
        .where(and(...conds, inArray(mangaTable.genre, topGenres))).orderBy(desc(mangaTable.views)).limit(12)
    : [];
  if (rows.length < 6) {
    const have = new Set(rows.map(r => r.id));
    const more = await db.select(cardFields).from(mangaTable).innerJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
      .where(and(...conds)).orderBy(desc(mangaTable.views)).limit(12);
    rows = [...rows, ...more.filter(m => !have.has(m.id))].slice(0, 12);
  }
  res.json({ basedOn: topGenres, items: rows });
});

/* ---------------- Views ---------------- */

// One counted view per reader per chapter per day (kept in memory; resets on restart, which is fine).
const seen = new Map<string, number>();
const today = () => new Date().toISOString().slice(0, 10);

router.post("/views/chapters/:id", async (req, res): Promise<void> => {
  const chapterId = Number(req.params.id);
  const [ch] = await db.select({ id: chaptersTable.id, mangaId: chaptersTable.mangaId, creatorId: mangaTable.creatorId })
    .from(chaptersTable).innerJoin(mangaTable, eq(chaptersTable.mangaId, mangaTable.id)).where(eq(chaptersTable.id, chapterId));
  if (!ch) { res.status(404).json({ error: "Chapter not found" }); return; }
  if (canManage(req.user, ch.creatorId)) { res.json({ counted: false }); return; } // creators reading their own work don't count

  const day = today();
  const viewer = req.user ? `u${req.user.id}` : crypto.createHash("sha1").update(`${req.ip}|${req.headers["user-agent"] ?? ""}`).digest("hex");
  const key = `${day}:${viewer}:${chapterId}`;
  if (seen.has(key)) { res.json({ counted: false }); return; }
  seen.set(key, Date.now());
  if (seen.size > 200_000) for (const k of seen.keys()) { if (!k.startsWith(day)) seen.delete(k); }

  await db.insert(viewsDailyTable).values({ day, creatorId: ch.creatorId, mangaId: ch.mangaId, chapterId, count: 1 })
    .onConflictDoUpdate({ target: [viewsDailyTable.day, viewsDailyTable.chapterId], set: { count: sql`${viewsDailyTable.count} + 1` } });
  await db.update(chaptersTable).set({ views: sql`${chaptersTable.views} + 1` }).where(eq(chaptersTable.id, chapterId));
  await db.update(mangaTable).set({ views: sql`${mangaTable.views} + 1` }).where(eq(mangaTable.id, ch.mangaId));
  await db.update(creatorsTable).set({ totalViews: sql`${creatorsTable.totalViews} + 1` }).where(eq(creatorsTable.id, ch.creatorId));
  res.json({ counted: true });
});

/* ---------------- Leaderboards ---------------- */

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

router.get("/leaderboards/:tab", async (req, res): Promise<void> => {
  const tab = String(req.params.tab);
  const limit = 25;

  if (tab === "weekly" || tab === "monthly") {
    const since = daysAgo(tab === "weekly" ? 7 : 30);
    const periodViews = sql<number>`coalesce(sum(${viewsDailyTable.count}), 0)::int`;
    const rows = await db.select({ ...cardFields, periodViews })
      .from(mangaTable)
      .innerJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
      .leftJoin(viewsDailyTable, and(eq(viewsDailyTable.mangaId, mangaTable.id), gte(viewsDailyTable.day, since)))
      .where(visibleManga(req.user))
      .groupBy(mangaTable.id, creatorsTable.id)
      .orderBy(desc(periodViews), desc(mangaTable.views))
      .limit(limit);
    res.json(rows.map((r, i) => ({ rank: i + 1, kind: "series", ...r })));
    return;
  }

  if (tab === "new") {
    // Series that started in the last 60 days, ranked by reads.
    const rows = await db.select({ ...cardFields, createdAt: mangaTable.createdAt })
      .from(mangaTable).innerJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
      .where(and(visibleManga(req.user), gte(mangaTable.createdAt, new Date(Date.now() - 60 * 86_400_000))))
      .orderBy(desc(mangaTable.views), desc(mangaTable.likes)).limit(limit);
    res.json(rows.map((r, i) => ({ rank: i + 1, kind: "series", ...r, createdAt: r.createdAt.toISOString(), periodViews: r.views })));
    return;
  }

  if (tab === "studios") {
    const since = daysAgo(30);
    const periodViews = sql<number>`coalesce(sum(${viewsDailyTable.count}), 0)::int`;
    const rows = await db.select({
      id: creatorsTable.id, name: creatorsTable.name, avatar: creatorsTable.avatar, type: creatorsTable.type,
      city: creatorsTable.city, state: creatorsTable.state, followers: creatorsTable.followers, totalViews: creatorsTable.totalViews,
      totalManga: creatorsTable.totalManga, isVerified: creatorsTable.isVerified, isRegisteredStudio: creatorsTable.isRegisteredStudio,
      periodViews,
    }).from(creatorsTable)
      .leftJoin(viewsDailyTable, and(eq(viewsDailyTable.creatorId, creatorsTable.id), gte(viewsDailyTable.day, since)))
      .where(and(eq(creatorsTable.status, "approved"), eq(creatorsTable.type, "studio")))
      .groupBy(creatorsTable.id)
      .orderBy(desc(periodViews), desc(creatorsTable.totalViews), desc(creatorsTable.followers))
      .limit(limit);
    res.json(rows.map((r, i) => ({ rank: i + 1, kind: "studio", ...r })));
    return;
  }

  res.status(400).json({ error: "Unknown leaderboard" });
});

/** Genres for pickers (onboarding/settings). */
router.get("/genres/names", async (_req, res): Promise<void> => {
  const rows = await db.select({ name: genresTable.name }).from(genresTable).orderBy(genresTable.name);
  res.json(rows.map(r => r.name));
});

export default router;
