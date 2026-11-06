import { Router, type IRouter } from "express";
import { requireCreator } from "../lib/auth";
import { desc, eq, ilike, and, sql } from "drizzle-orm";
import { db, mangaTable, creatorsTable, genresTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/manga", async (req, res): Promise<void> => {
  const { genre, language, sort, search, limit = "20", offset = "0" } = req.query as Record<string, string>;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const off = parseInt(offset, 10) || 0;

  const conditions: ReturnType<typeof eq>[] = [];
  if (genre) conditions.push(eq(mangaTable.genre, genre));
  if (language) conditions.push(eq(mangaTable.language, language));
  if (search) conditions.push(ilike(mangaTable.title, `%${search}%`));

  let orderBy = desc(mangaTable.views);
  if (sort === "latest" || sort === "new") orderBy = desc(mangaTable.createdAt);
  else if (sort === "popular") orderBy = desc(mangaTable.likes);

  const rows = await db
    .select({
      id: mangaTable.id,
      title: mangaTable.title,
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
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
  }).returning();
  await db.update(creatorsTable).set({ totalManga: sql`${creatorsTable.totalManga} + 1` }).where(eq(creatorsTable.id, m.creatorId));
  await db.update(genresTable).set({ mangaCount: sql`${genresTable.mangaCount} + 1` }).where(eq(genresTable.name, genre));
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
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
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
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
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
    .where(eq(mangaTable.isFeatured, true))
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
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
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
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
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
    .where(sql`${mangaTable.monthlyRank} IS NOT NULL`)
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
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
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
    .where(eq(mangaTable.id, mangaId));

  if (!row) { res.status(404).json({ error: "Manga not found" }); return; }
  await db.update(mangaTable).set({ views: sql`${mangaTable.views} + 1` }).where(eq(mangaTable.id, mangaId));
  res.json({
    ...row,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
    tags: row.tags ?? [],
  });
});

router.post("/manga/:mangaId/like", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.mangaId) ? req.params.mangaId[0] : req.params.mangaId;
  const mangaId = parseInt(raw, 10);
  if (isNaN(mangaId)) { res.status(400).json({ error: "Invalid manga id" }); return; }

  const [m] = await db.update(mangaTable)
    .set({ likes: sql`${mangaTable.likes} + 1` })
    .where(eq(mangaTable.id, mangaId))
    .returning({ likes: mangaTable.likes });

  if (!m) { res.status(404).json({ error: "Manga not found" }); return; }
  res.json({ liked: true, totalLikes: m.likes });
});

export default router;
