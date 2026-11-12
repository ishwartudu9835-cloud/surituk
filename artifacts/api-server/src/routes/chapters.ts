import { needAccess } from "../lib/auth";
import { notifyAdmins } from "../lib/deletion";
import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, chaptersTable, mangaTable } from "@workspace/db";
import { requireCreator } from "../lib/auth";
import { canManage, visibleManga } from "../lib/visibility";
import { creatorsTable } from "@workspace/db";
import { notifySubscribers } from "../lib/notify";

const router: IRouter = Router();

/** Series must be published by an approved creator (and 18+ only for adults), unless you own it. */
async function seriesReadable(req: import("express").Request, mangaId: number) {
  const [m] = await db.select({ creatorId: mangaTable.creatorId, isPublished: mangaTable.isPublished, isMature: mangaTable.isMature, status: creatorsTable.status })
    .from(mangaTable).leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id)).where(eq(mangaTable.id, mangaId));
  if (!m) return false;
  if (canManage(req.user, m.creatorId)) return true;
  if (!m.isPublished || m.status !== "approved") return false;
  if (m.isMature && !req.user?.isAdult) return false;
  return true;
}

router.get("/manga/:mangaId/chapters", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.mangaId) ? req.params.mangaId[0] : req.params.mangaId;
  const mangaId = parseInt(raw, 10);
  if (isNaN(mangaId)) { res.status(400).json({ error: "Invalid manga id" }); return; }

  if (!(await seriesReadable(req, mangaId))) { res.json([]); return; }

  const rows = await db
    .select({
      id: chaptersTable.id,
      mangaId: chaptersTable.mangaId,
      mangaTitle: mangaTable.title,
      mangaSlug: mangaTable.slug,
      chapterNumber: chaptersTable.chapterNumber,
      title: chaptersTable.title,
      pages: chaptersTable.pages,
      views: chaptersTable.views,
      isScheduled: chaptersTable.isScheduled,
      scheduledAt: chaptersTable.scheduledAt,
      createdAt: chaptersTable.createdAt,
    })
    .from(chaptersTable)
    .leftJoin(mangaTable, eq(chaptersTable.mangaId, mangaTable.id))
    .where(eq(chaptersTable.mangaId, mangaId))
    .orderBy(chaptersTable.chapterNumber);

  res.json(rows.map(r => ({
    ...r,
    pages: r.pages ?? [],
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    scheduledAt: r.scheduledAt?.toISOString() ?? null,
  })));
});

router.post("/manga/:mangaId/chapters", requireCreator, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.mangaId) ? req.params.mangaId[0] : req.params.mangaId;
  const mangaId = parseInt(raw, 10);
  if (isNaN(mangaId)) { res.status(400).json({ error: "Invalid manga id" }); return; }

  const [owned] = await db.select({ creatorId: mangaTable.creatorId }).from(mangaTable).where(eq(mangaTable.id, mangaId));
  if (!owned) { res.status(404).json({ error: "Manga not found" }); return; }
  if (owned.creatorId !== req.user!.creatorId && req.user!.role !== "admin") {
    res.status(403).json({ error: "You can only add chapters to your own manga" });
    return;
  }
  if (!needAccess(req, res, "editor", "upload chapters")) return;
  if (req.body?.ownershipConfirmed !== true && req.user!.role !== "admin") {
    res.status(400).json({ error: "Please confirm this chapter is your own original work (or you have the rights)." });
    return;
  }

  const { chapterNumber, title, pages, scheduledAt } = req.body;
  if (pages !== undefined && (!Array.isArray(pages) || pages.some((p: unknown) => typeof p !== "string"))) {
    res.status(400).json({ error: "pages must be a list of image URLs" });
    return;
  }
  if (!chapterNumber || !title) {
    res.status(400).json({ error: "chapterNumber and title are required" });
    return;
  }

  // A new creator's first 2 chapters go to the admin review list (they're live meanwhile).
  const [{ prior }] = await db.select({ prior: sql<number>`count(*)::int` }).from(chaptersTable)
    .innerJoin(mangaTable, eq(chaptersTable.mangaId, mangaTable.id)).where(eq(mangaTable.creatorId, owned.creatorId));
  const needsReview = prior < 2 && req.user!.role !== "admin";

  const [ch] = await db.insert(chaptersTable).values({
    mangaId,
    chapterNumber,
    title,
    needsReview,
    uploadedBy: req.user!.id,
    pagesUpdatedAt: new Date(),
    pages: pages ?? [],
    isScheduled: !!scheduledAt,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
  }).returning();

  await db.update(mangaTable)
    .set({ chapterCount: sql`${mangaTable.chapterCount} + 1` })
    .where(eq(mangaTable.id, mangaId));
  if (needsReview) void notifyAdmins(`🆕 New creator chapter to check: "${title}". See Admin → First chapters.`);

  const [series] = await db.select({ title: mangaTable.title, creatorId: mangaTable.creatorId, isPublished: mangaTable.isPublished }).from(mangaTable).where(eq(mangaTable.id, mangaId));
  if (series?.isPublished) void notifySubscribers(series.creatorId, `New chapter: "${series.title}" — Chapter ${chapterNumber}: ${title}`, mangaId);

  res.status(201).json({
    ...ch,
    mangaTitle: null,
    pages: ch.pages ?? [],
    createdAt: ch.createdAt.toISOString(),
    scheduledAt: ch.scheduledAt?.toISOString() ?? null,
  });
});

router.get("/manga/:mangaId/chapters/:chapterId", async (req, res): Promise<void> => {
  const rawManga = Array.isArray(req.params.mangaId) ? req.params.mangaId[0] : req.params.mangaId;
  const rawChapter = Array.isArray(req.params.chapterId) ? req.params.chapterId[0] : req.params.chapterId;
  const mangaId = parseInt(rawManga, 10);
  const chapterId = parseInt(rawChapter, 10);
  if (isNaN(mangaId) || isNaN(chapterId)) { res.status(400).json({ error: "Invalid ids" }); return; }

  const [row] = await db
    .select({
      id: chaptersTable.id,
      mangaId: chaptersTable.mangaId,
      mangaTitle: mangaTable.title,
      mangaSlug: mangaTable.slug,
      creatorName: creatorsTable.name,
      chapterNumber: chaptersTable.chapterNumber,
      title: chaptersTable.title,
      pages: chaptersTable.pages,
      views: chaptersTable.views,
      isScheduled: chaptersTable.isScheduled,
      scheduledAt: chaptersTable.scheduledAt,
      createdAt: chaptersTable.createdAt,
    })
    .from(chaptersTable)
    .leftJoin(mangaTable, eq(chaptersTable.mangaId, mangaTable.id))
    .leftJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(eq(chaptersTable.id, chapterId));

  if (!row) { res.status(404).json({ error: "Chapter not found" }); return; }
  if (row.mangaId !== mangaId || !(await seriesReadable(req, row.mangaId))) { res.status(404).json({ error: "Chapter not found" }); return; }

  res.json({
    ...row,
    pages: row.pages ?? [],
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
  });
});

router.get("/chapters/latest", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "12", 10), 50);
  const rows = await db
    .select({
      id: chaptersTable.id,
      mangaId: chaptersTable.mangaId,
      mangaTitle: mangaTable.title,
      mangaSlug: mangaTable.slug,
      chapterNumber: chaptersTable.chapterNumber,
      title: chaptersTable.title,
      pages: chaptersTable.pages,
      views: chaptersTable.views,
      isScheduled: chaptersTable.isScheduled,
      scheduledAt: chaptersTable.scheduledAt,
      createdAt: chaptersTable.createdAt,
    })
    .from(chaptersTable)
    .innerJoin(mangaTable, eq(chaptersTable.mangaId, mangaTable.id))
    .innerJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(visibleManga(req.user))
    .orderBy(desc(chaptersTable.createdAt))
    .limit(limit);

  res.json(rows.map(r => ({
    ...r,
    pages: r.pages ?? [],
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    scheduledAt: r.scheduledAt?.toISOString() ?? null,
  })));
});

export default router;
