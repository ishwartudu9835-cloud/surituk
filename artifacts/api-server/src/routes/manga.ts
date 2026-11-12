import { needAccess, requireAuth } from "../lib/auth";
import { requireTrusted } from "../lib/trust";
import { checkTitle, titleError } from "../lib/piracy";
import { assignMangaSlug } from "../lib/slug";
import { Router, type IRouter } from "express";
import { requireCreator, isApprovedCreator } from "../lib/auth";
import { notifySubscribers } from "../lib/notify";
import { desc, eq, ilike, and, sql, type SQL, or } from "drizzle-orm";
import { visibleManga, canManage } from "../lib/visibility";
import { db, mangaLikesTable, bookmarksTable, mangaTable, creatorsTable, genresTable } from "@workspace/db";

const router: IRouter = Router();

/** Resolve a readable series URL ("/manga/supar-man-bana-lazy-man") to its id. */
router.get("/manga-slug/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug ?? "").normalize("NFC").toLowerCase();
  const [row] = await db.select({ id: mangaTable.id }).from(mangaTable).where(eq(mangaTable.slug, slug));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: row.id });
});

router.get("/manga", async (req, res): Promise<void> => {
  const { genre, language, sort, search, limit = "20", offset = "0" } = req.query as Record<string, string>;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const off = parseInt(offset, 10) || 0;

  const conditions: SQL[] = [visibleManga(req.user)];
  if (genre) conditions.push(eq(mangaTable.genre, genre));
  if (language) conditions.push(eq(mangaTable.language, language));
  if (search) {
    // Matches the story title or the creator / studio name.
    const term = `%${search.trim().slice(0, 80).replace(/[\\%_]/g, m => "\\" + m)}%`;
    conditions.push(or(ilike(mangaTable.title, term), ilike(creatorsTable.name, term))!);
  }

  let orderBy = desc(mangaTable.views);
  if (sort === "latest" || sort === "new") orderBy = desc(mangaTable.createdAt);
  else if (sort === "popular") orderBy = desc(mangaTable.likes);

  const rows = await db
    .select({
      id: mangaTable.id,
      title: mangaTable.title,
      slug: mangaTable.slug,
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
      creatorSlug: creatorsTable.slug,
      creatorAvatar: creatorsTable.avatar,
      coverImage: mangaTable.coverImage,
      bannerImage: mangaTable.bannerImage,
      genre: mangaTable.genre,
      tags: mangaTable.tags,
      language: mangaTable.language,
      status: mangaTable.status,
      views: mangaTable.views,
      likes: mangaTable.likes,
      chapterCount: mangaTable.chapterCount,
      rating: mangaTable.rating,
      isFeatured: mangaTable.isFeatured,
      isSponsored: mangaTable.isSponsored,
      weeklyRank: mangaTable.weeklyRank,
      monthlyRank: mangaTable.monthlyRank,
      createdAt: mangaTable.createdAt,
      updatedAt: mangaTable.updatedAt,
    })
    .from(mangaTable)
    .leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy)
    .limit(lim)
    .offset(off);

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
    tags: r.tags ?? [],
  })));
});

router.post("/manga", requireCreator, async (req, res): Promise<void> => {
  const { title, description, coverImage, bannerImage, genre, tags, language } = req.body;
  if (!title || !genre) {
    res.status(400).json({ error: "title and genre are required" });
    return;
  }
  if (!needAccess(req, res, "editor", "create series")) return;
  if (req.user!.role !== "admin") {
    const hit = await checkTitle(String(title));
    if (hit) { res.status(400).json({ error: titleError(hit) }); return; }
    if (req.body?.ownershipConfirmed !== true) { res.status(400).json({ error: "Please confirm this story is your own original work (or you have the rights)." }); return; }
  }
  // Pending applicants can only create private drafts. Approved creators choose (default: draft).
  const publish = isApprovedCreator(req) && req.body?.publish === true;
  const isMature = req.body?.isMature === true;
  const [m] = await db.insert(mangaTable).values({
    title,
    description,
    creatorId: req.user!.creatorId!,
    coverImage: coverImage || `https://picsum.photos/seed/${encodeURIComponent(title)}/400/560`,
    bannerImage,
    genre,
    tags: tags ?? [],
    language: language ?? "English",
    status: "ongoing",
    isPublished: publish,
    isMature,
  }).returning();
  m.slug = await assignMangaSlug(m.id, m.title);
  if (publish) {
    await db.update(creatorsTable).set({ totalManga: sql`${creatorsTable.totalManga} + 1` }).where(eq(creatorsTable.id, m.creatorId));
    await db.update(genresTable).set({ mangaCount: sql`${genresTable.mangaCount} + 1` }).where(eq(genresTable.name, genre));
    const [author] = await db.select({ name: creatorsTable.name }).from(creatorsTable).where(eq(creatorsTable.id, m.creatorId));
    void notifySubscribers(m.creatorId, `${author?.name ?? "A creator you follow"} started a new series: "${m.title}"`, m.id);
  }
  res.status(201).json({
    ...m,
    creatorName: "Creator",
    creatorAvatar: null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt?.toISOString() ?? null,
    tags: m.tags ?? [],
  });
});

router.get("/manga/trending", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "10", 10), 50);
  const rows = await db
    .select({
      id: mangaTable.id,
      title: mangaTable.title,
      slug: mangaTable.slug,
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
      creatorSlug: creatorsTable.slug,
      creatorAvatar: creatorsTable.avatar,
      coverImage: mangaTable.coverImage,
      bannerImage: mangaTable.bannerImage,
      genre: mangaTable.genre,
      tags: mangaTable.tags,
      language: mangaTable.language,
      status: mangaTable.status,
      views: mangaTable.views,
      likes: mangaTable.likes,
      chapterCount: mangaTable.chapterCount,
      rating: mangaTable.rating,
      isFeatured: mangaTable.isFeatured,
      isSponsored: mangaTable.isSponsored,
      weeklyRank: mangaTable.weeklyRank,
      monthlyRank: mangaTable.monthlyRank,
      createdAt: mangaTable.createdAt,
      updatedAt: mangaTable.updatedAt,
    })
    .from(mangaTable)
    .leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(visibleManga(req.user))
    .orderBy(desc(mangaTable.views))
    .limit(limit);

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
    tags: r.tags ?? [],
  })));
});

router.get("/manga/featured", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: mangaTable.id,
      title: mangaTable.title,
      slug: mangaTable.slug,
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
      creatorSlug: creatorsTable.slug,
      creatorAvatar: creatorsTable.avatar,
      coverImage: mangaTable.coverImage,
      bannerImage: mangaTable.bannerImage,
      genre: mangaTable.genre,
      tags: mangaTable.tags,
      language: mangaTable.language,
      status: mangaTable.status,
      views: mangaTable.views,
      likes: mangaTable.likes,
      chapterCount: mangaTable.chapterCount,
      rating: mangaTable.rating,
      isFeatured: mangaTable.isFeatured,
      isSponsored: mangaTable.isSponsored,
      weeklyRank: mangaTable.weeklyRank,
      monthlyRank: mangaTable.monthlyRank,
      createdAt: mangaTable.createdAt,
      updatedAt: mangaTable.updatedAt,
    })
    .from(mangaTable)
    .leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(and(eq(mangaTable.isFeatured, true), visibleManga(req.user)))
    .orderBy(desc(mangaTable.views))
    .limit(5);

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
    tags: r.tags ?? [],
  })));
});

router.get("/manga/new-releases", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "12", 10), 50);
  const rows = await db
    .select({
      id: mangaTable.id,
      title: mangaTable.title,
      slug: mangaTable.slug,
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
      creatorSlug: creatorsTable.slug,
      creatorAvatar: creatorsTable.avatar,
      coverImage: mangaTable.coverImage,
      bannerImage: mangaTable.bannerImage,
      genre: mangaTable.genre,
      tags: mangaTable.tags,
      language: mangaTable.language,
      status: mangaTable.status,
      views: mangaTable.views,
      likes: mangaTable.likes,
      chapterCount: mangaTable.chapterCount,
      rating: mangaTable.rating,
      isFeatured: mangaTable.isFeatured,
      isSponsored: mangaTable.isSponsored,
      weeklyRank: mangaTable.weeklyRank,
      monthlyRank: mangaTable.monthlyRank,
      createdAt: mangaTable.createdAt,
      updatedAt: mangaTable.updatedAt,
    })
    .from(mangaTable)
    .leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(visibleManga(req.user))
    .orderBy(desc(mangaTable.createdAt))
    .limit(limit);

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
    tags: r.tags ?? [],
  })));
});

router.get("/manga/top-monthly", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: mangaTable.id,
      title: mangaTable.title,
      slug: mangaTable.slug,
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
      creatorSlug: creatorsTable.slug,
      creatorAvatar: creatorsTable.avatar,
      coverImage: mangaTable.coverImage,
      bannerImage: mangaTable.bannerImage,
      genre: mangaTable.genre,
      tags: mangaTable.tags,
      language: mangaTable.language,
      status: mangaTable.status,
      views: mangaTable.views,
      likes: mangaTable.likes,
      chapterCount: mangaTable.chapterCount,
      rating: mangaTable.rating,
      isFeatured: mangaTable.isFeatured,
      isSponsored: mangaTable.isSponsored,
      weeklyRank: mangaTable.weeklyRank,
      monthlyRank: mangaTable.monthlyRank,
      createdAt: mangaTable.createdAt,
      updatedAt: mangaTable.updatedAt,
    })
    .from(mangaTable)
    .leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(and(sql`${mangaTable.monthlyRank} IS NOT NULL`, visibleManga(req.user)))
    .orderBy(mangaTable.monthlyRank)
    .limit(3);

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
    tags: r.tags ?? [],
  })));
});

router.get("/manga/:mangaId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.mangaId) ? req.params.mangaId[0] : req.params.mangaId;
  const mangaId = parseInt(raw, 10);
  if (isNaN(mangaId)) { res.status(400).json({ error: "Invalid manga id" }); return; }

  const [row] = await db
    .select({
      id: mangaTable.id,
      title: mangaTable.title,
      slug: mangaTable.slug,
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
      creatorSlug: creatorsTable.slug,
      creatorAvatar: creatorsTable.avatar,
      coverImage: mangaTable.coverImage,
      bannerImage: mangaTable.bannerImage,
      genre: mangaTable.genre,
      tags: mangaTable.tags,
      language: mangaTable.language,
      status: mangaTable.status,
      views: mangaTable.views,
      likes: mangaTable.likes,
      chapterCount: mangaTable.chapterCount,
      rating: mangaTable.rating,
      isFeatured: mangaTable.isFeatured,
      isSponsored: mangaTable.isSponsored,
      weeklyRank: mangaTable.weeklyRank,
      monthlyRank: mangaTable.monthlyRank,
      createdAt: mangaTable.createdAt,
      updatedAt: mangaTable.updatedAt,
      isPublished: mangaTable.isPublished,
      isMature: mangaTable.isMature,
      creatorStatus: creatorsTable.status,
      creatorType: creatorsTable.type,
    })
    .from(mangaTable)
    .leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(eq(mangaTable.id, mangaId));

  if (!row) { res.status(404).json({ error: "Graphic novel not found" }); return; }
  const owner = canManage(req.user, row.creatorId);
  if (!owner && (!row.isPublished || row.creatorStatus !== "approved")) { res.status(404).json({ error: "Graphic novel not found" }); return; }
  if (!owner && row.isMature && !req.user?.isAdult) { res.status(403).json({ error: "This series is for readers 18+", mature: true }); return; }
  res.json({
    ...row,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
    tags: row.tags ?? [],
  });
});

/** One like per reader per story — tapping again removes it. */
router.get("/manga/:mangaId/like", async (req, res): Promise<void> => {
  const mangaId = parseInt(String(req.params.mangaId), 10);
  const [m] = await db.select({ likes: mangaTable.likes }).from(mangaTable).where(eq(mangaTable.id, mangaId));
  if (!m) { res.status(404).json({ error: "Manga not found" }); return; }
  const liked = req.user ? (await db.select({ u: mangaLikesTable.userId }).from(mangaLikesTable).where(and(eq(mangaLikesTable.mangaId, mangaId), eq(mangaLikesTable.userId, req.user.id)))).length > 0 : false;
  const bookmarked = req.user ? (await db.select({ id: bookmarksTable.id }).from(bookmarksTable).where(and(eq(bookmarksTable.mangaId, mangaId), eq(bookmarksTable.userId, req.user.id)))).length > 0 : false;
  res.json({ liked, totalLikes: m.likes, bookmarked });
});

router.post("/manga/:mangaId/like", requireAuth, async (req, res): Promise<void> => {
  if (!requireTrusted(req, res)) return;
  const mangaId = parseInt(String(req.params.mangaId), 10);
  if (isNaN(mangaId)) { res.status(400).json({ error: "Invalid manga id" }); return; }
  const [exists] = await db.select({ id: mangaTable.id }).from(mangaTable).where(eq(mangaTable.id, mangaId));
  if (!exists) { res.status(404).json({ error: "Manga not found" }); return; }
  const added = await db.insert(mangaLikesTable).values({ mangaId, userId: req.user!.id }).onConflictDoNothing().returning();
  if (added.length) {
    await db.update(mangaTable).set({ likes: sql`${mangaTable.likes} + 1` }).where(eq(mangaTable.id, mangaId));
  } else {
    await db.delete(mangaLikesTable).where(and(eq(mangaLikesTable.mangaId, mangaId), eq(mangaLikesTable.userId, req.user!.id)));
    await db.update(mangaTable).set({ likes: sql`greatest(${mangaTable.likes} - 1, 0)` }).where(eq(mangaTable.id, mangaId));
  }
  const [m] = await db.select({ likes: mangaTable.likes }).from(mangaTable).where(eq(mangaTable.id, mangaId));
  res.json({ liked: added.length > 0, totalLikes: m?.likes ?? 0 });
});

/** Save a story to My Library — tapping again removes it. */
router.post("/manga/:mangaId/bookmark", requireAuth, async (req, res): Promise<void> => {
  const mangaId = parseInt(String(req.params.mangaId), 10);
  const [exists] = await db.select({ id: mangaTable.id }).from(mangaTable).where(eq(mangaTable.id, mangaId));
  if (!exists) { res.status(404).json({ error: "Manga not found" }); return; }
  const [b] = await db.select({ id: bookmarksTable.id }).from(bookmarksTable).where(and(eq(bookmarksTable.mangaId, mangaId), eq(bookmarksTable.userId, req.user!.id)));
  if (b) await db.delete(bookmarksTable).where(eq(bookmarksTable.id, b.id));
  else await db.insert(bookmarksTable).values({ mangaId, userId: req.user!.id });
  res.json({ bookmarked: !b });
});

export default router;
