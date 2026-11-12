import { assignMangaSlug } from "../lib/slug";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db, mangaTable, chaptersTable, creatorsTable, genresTable, bookmarksTable, readingHistoryTable, communityPostsTable,
  type Manga,
} from "@workspace/db";
import { requireCreator, isApprovedCreator, needAccess, hasAccess } from "../lib/auth";
import { checkTitle, titleError } from "../lib/piracy";
import { notifySubscribers } from "../lib/notify";
import { desc } from "drizzle-orm";

/** Creator Studio: edit / delete your own series and chapters. */
const router: IRouter = Router();

const num = (req: Request, name: string) => {
  const raw = req.params[name];
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
};
const isUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//.test(v) && v.length < 600;
const STATUSES = ["ongoing", "completed", "hiatus"];

/** Loads a series and checks that the logged-in creator owns it (admins can manage everything). */
async function ownedSeries(req: Request, res: Response, id: number): Promise<Manga | null> {
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return null; }
  const [m] = await db.select().from(mangaTable).where(eq(mangaTable.id, id));
  if (!m) { res.status(404).json({ error: "Series not found" }); return null; }
  if (m.creatorId !== req.user!.creatorId && req.user!.role !== "admin") { res.status(403).json({ error: "This is not your series" }); return null; }
  return m;
}

/** All of my series, drafts included. */
router.get("/studio/my-series", requireCreator, async (req, res): Promise<void> => {
  const rows = await db.select().from(mangaTable).where(eq(mangaTable.creatorId, req.user!.creatorId!)).orderBy(desc(mangaTable.updatedAt));
  res.json(rows.map(r => ({ ...r, tags: r.tags ?? [], createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
});

router.get("/studio/series/:id", requireCreator, async (req, res): Promise<void> => {
  const m = await ownedSeries(req, res, num(req, "id"));
  if (!m) return;
  res.json({ ...m, tags: m.tags ?? [], createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() });
});

router.patch("/studio/series/:id", requireCreator, async (req, res): Promise<void> => {
  const m = await ownedSeries(req, res, num(req, "id"));
  if (!m) return;
  if (!needAccess(req, res, "editor", "edit series")) return;
  const b = req.body ?? {};
  const patch: Partial<typeof mangaTable.$inferInsert> = { updatedAt: new Date() };

  if (b.title !== undefined) {
    const t = String(b.title).trim().slice(0, 150);
    if (!t) { res.status(400).json({ error: "Title can't be empty" }); return; }
    const hit = t !== m.title ? await checkTitle(t) : null;
    if (hit && req.user!.role !== "admin") { res.status(400).json({ error: titleError(hit) }); return; }
    patch.title = t;
  }
  if (b.description !== undefined) patch.description = String(b.description).trim().slice(0, 3000) || null;
  if (b.language !== undefined) patch.language = String(b.language).trim().slice(0, 40) || "English";
  if (b.coverImage !== undefined) { if (!isUrl(b.coverImage)) { res.status(400).json({ error: "Cover image is required" }); return; } patch.coverImage = b.coverImage; }
  if (b.bannerImage !== undefined) patch.bannerImage = isUrl(b.bannerImage) ? b.bannerImage : null;
  if (b.status !== undefined) { if (!STATUSES.includes(b.status)) { res.status(400).json({ error: "Invalid status" }); return; } patch.status = b.status; }
  if (typeof b.isMature === "boolean") patch.isMature = b.isMature;
  if (typeof b.isPublished === "boolean" && b.isPublished !== m.isPublished) {
    if (b.isPublished && !isApprovedCreator(req) && req.user!.role !== "admin") { res.status(403).json({ error: "You can publish after your creator account is approved. Until then, series stay as private drafts." }); return; }
    if (b.isPublished) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(chaptersTable).where(eq(chaptersTable.mangaId, m.id));
      if (n === 0) { res.status(400).json({ error: "Add at least one chapter before publishing" }); return; }
    }
    patch.isPublished = b.isPublished;
  }
  if (Array.isArray(b.tags)) patch.tags = b.tags.map((t: unknown) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 8);
  if (b.genre !== undefined && b.genre !== m.genre) {
    const [g] = await db.select({ id: genresTable.id }).from(genresTable).where(eq(genresTable.name, String(b.genre)));
    if (!g) { res.status(400).json({ error: "Unknown genre" }); return; }
    patch.genre = String(b.genre);
    if (m.isPublished) await db.update(genresTable).set({ mangaCount: sql`greatest(${genresTable.mangaCount} - 1, 0)` }).where(eq(genresTable.name, m.genre));
    if (m.isPublished) await db.update(genresTable).set({ mangaCount: sql`${genresTable.mangaCount} + 1` }).where(eq(genresTable.name, patch.genre));
  }

  const [updated] = await db.update(mangaTable).set(patch).where(eq(mangaTable.id, m.id)).returning();
  // The readable URL follows the title until the series is first published; after that it stays put so shared links keep working.
  if (patch.title && patch.title !== m.title && !m.isPublished) updated.slug = await assignMangaSlug(updated.id, updated.title);
  if (patch.isPublished !== undefined) {
    const d = patch.isPublished ? 1 : -1;
    await db.update(creatorsTable).set({ totalManga: sql`greatest(${creatorsTable.totalManga} + ${d}, 0)` }).where(eq(creatorsTable.id, m.creatorId));
    await db.update(genresTable).set({ mangaCount: sql`greatest(${genresTable.mangaCount} + ${d}, 0)` }).where(eq(genresTable.name, updated.genre));
    if (patch.isPublished) {
      const [author] = await db.select({ name: creatorsTable.name }).from(creatorsTable).where(eq(creatorsTable.id, m.creatorId));
      void notifySubscribers(m.creatorId, `${author?.name ?? "A creator you follow"} published a new series: "${updated.title}"`, m.id);
    }
  }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
});

router.delete("/studio/series/:id", requireCreator, async (req, res): Promise<void> => {
  const m = await ownedSeries(req, res, num(req, "id"));
  if (!m) return;
  if (!needAccess(req, res, "owner", "delete a story")) return;
  await db.transaction(async tx => {
    await tx.delete(readingHistoryTable).where(eq(readingHistoryTable.mangaId, m.id));
    await tx.delete(bookmarksTable).where(eq(bookmarksTable.mangaId, m.id));
    await tx.delete(chaptersTable).where(eq(chaptersTable.mangaId, m.id));
    await tx.update(communityPostsTable).set({ relatedMangaId: null }).where(eq(communityPostsTable.relatedMangaId, m.id));
    await tx.delete(mangaTable).where(eq(mangaTable.id, m.id));
    if (m.isPublished) {
      await tx.update(creatorsTable).set({ totalManga: sql`greatest(${creatorsTable.totalManga} - 1, 0)` }).where(eq(creatorsTable.id, m.creatorId));
      await tx.update(genresTable).set({ mangaCount: sql`greatest(${genresTable.mangaCount} - 1, 0)` }).where(eq(genresTable.name, m.genre));
    }
  });
  res.json({ ok: true });
});

async function ownedChapter(req: Request, res: Response) {
  const id = num(req, "id");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return null; }
  const [ch] = await db.select().from(chaptersTable).where(eq(chaptersTable.id, id));
  if (!ch) { res.status(404).json({ error: "Chapter not found" }); return null; }
  const m = await ownedSeries(req, res, ch.mangaId);
  return m ? ch : null;
}

/** Edit a chapter: title, number, and the full ordered list of page image URLs. */
router.patch("/studio/chapters/:id", requireCreator, async (req, res): Promise<void> => {
  const ch = await ownedChapter(req, res);
  if (!ch) return;
  if (!needAccess(req, res, "editor", "edit chapters")) return;
  const b = req.body ?? {};
  const patch: Partial<typeof chaptersTable.$inferInsert> = {};
  if (b.title !== undefined) {
    const t = String(b.title).trim().slice(0, 150);
    if (!t) { res.status(400).json({ error: "Title can't be empty" }); return; }
    patch.title = t;
  }
  if (b.chapterNumber !== undefined) {
    const n = Number(b.chapterNumber);
    if (!Number.isFinite(n) || n < 0) { res.status(400).json({ error: "Invalid chapter number" }); return; }
    const [clash] = await db.select({ id: chaptersTable.id }).from(chaptersTable)
      .where(and(eq(chaptersTable.mangaId, ch.mangaId), eq(chaptersTable.chapterNumber, n)));
    if (clash && clash.id !== ch.id) { res.status(400).json({ error: `Chapter ${n} already exists` }); return; }
    patch.chapterNumber = n;
  }
  if (b.pages !== undefined) {
    if (!Array.isArray(b.pages) || !b.pages.every(isUrl)) { res.status(400).json({ error: "Pages must be a list of image links" }); return; }
    if (b.pages.length === 0) { res.status(400).json({ error: "A chapter needs at least one page" }); return; }
    if (b.pages.length > 300) { res.status(400).json({ error: "Maximum 300 pages per chapter" }); return; }
    // Adding pages at the end is upload work; removing or reordering pages needs a manager.
    const old = ch.pages ?? [];
    const appendOnly = b.pages.length >= old.length && old.every((p: string, i: number) => b.pages[i] === p);
    if (!appendOnly && !hasAccess(req, "manager")) { res.status(403).json({ error: "Only the owner or a manager can delete or reorder pages." }); return; }
    patch.pages = b.pages;
    patch.pagesUpdatedAt = new Date();
  }
  const [updated] = await db.update(chaptersTable).set(patch).where(eq(chaptersTable.id, ch.id)).returning();
  await db.update(mangaTable).set({ updatedAt: new Date() }).where(eq(mangaTable.id, ch.mangaId));
  res.json({ ...updated, pages: updated.pages ?? [], createdAt: updated.createdAt.toISOString(), scheduledAt: updated.scheduledAt?.toISOString() ?? null });
});

router.delete("/studio/chapters/:id", requireCreator, async (req, res): Promise<void> => {
  const ch = await ownedChapter(req, res);
  if (!ch) return;
  if (!needAccess(req, res, "manager", "delete chapters")) return;
  await db.delete(chaptersTable).where(eq(chaptersTable.id, ch.id));
  await db.update(mangaTable).set({ chapterCount: sql`greatest(${mangaTable.chapterCount} - 1, 0)`, updatedAt: new Date() }).where(eq(mangaTable.id, ch.mangaId));
  res.json({ ok: true });
});

export default router;
