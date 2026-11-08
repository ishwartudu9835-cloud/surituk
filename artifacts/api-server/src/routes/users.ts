import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  readingHistoryTable,
  bookmarksTable,
  mangaTable,
  notificationsTable,
} from "@workspace/db";

const router: IRouter = Router();

/**
 * Lookups by numeric id are owner-only (others get 404, so ids can't be used to list users).
 * Public profiles are reached by username instead; reading history and bookmarks stay private.
 */
function canView(req: { user?: { id: number; role?: string | null } | null }, userId: number): boolean {
  return !!req.user && (req.user.id === userId || req.user.role === "admin");
}

/** Public profile by username ("/u/ishwartudu9835"): name, picture, bio and points only. */
router.get("/users/by-username/:username", async (req, res): Promise<void> => {
  const username = String(req.params.username ?? "").trim().toLowerCase();
  const [row] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!row) { res.status(404).json({ error: "User not found" }); return; }
  res.json({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatar: row.avatar,
    bio: row.bio ?? null,
    points: row.points,
    weeklyPoints: row.weeklyPoints,
    monthlyPoints: row.monthlyPoints,
    rank: row.rank ?? null,
    completedManga: row.completedManga,
    joinedAt: row.joinedAt?.toISOString() ?? new Date().toISOString(),
  });
});

router.get("/users/:userId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
  if (!canView(req, userId)) { res.status(404).json({ error: "User not found" }); return; }

  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!row) { res.status(404).json({ error: "User not found" }); return; }

  res.json({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatar: row.avatar,
    bio: row.bio ?? null,
    points: row.points,
    weeklyPoints: row.weeklyPoints,
    monthlyPoints: row.monthlyPoints,
    rank: row.rank ?? null,
    completedManga: row.completedManga,
    joinedAt: row.joinedAt?.toISOString() ?? new Date().toISOString(),
  });
});

router.get("/users/:userId/reading-history", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
  if (!canView(req, userId)) { res.status(404).json({ error: "User not found" }); return; }

  const rows = await db
    .select({
      mangaId: readingHistoryTable.mangaId,
      lastChapter: readingHistoryTable.lastChapter,
      progress: readingHistoryTable.progress,
      isCompleted: readingHistoryTable.isCompleted,
      lastReadAt: readingHistoryTable.lastReadAt,
      mangaTitle: mangaTable.title,
      mangaSlug: mangaTable.slug,
      coverImage: mangaTable.coverImage,
    })
    .from(readingHistoryTable)
    .leftJoin(mangaTable, eq(readingHistoryTable.mangaId, mangaTable.id))
    .where(eq(readingHistoryTable.userId, userId))
    .orderBy(desc(readingHistoryTable.lastReadAt));

  res.json(rows.map(r => ({
    mangaId: r.mangaId,
    mangaTitle: r.mangaTitle ?? "Unknown",
    mangaSlug: r.mangaSlug ?? null,
    coverImage: r.coverImage ?? "",
    lastChapter: r.lastChapter,
    progress: r.progress,
    isCompleted: r.isCompleted,
    lastReadAt: r.lastReadAt?.toISOString() ?? new Date().toISOString(),
  })));
});

router.get("/users/:userId/bookmarks", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
  if (!canView(req, userId)) { res.status(404).json({ error: "User not found" }); return; }

  const rows = await db
    .select({
      id: mangaTable.id,
      title: mangaTable.title,
      slug: mangaTable.slug,
      description: mangaTable.description,
      creatorId: mangaTable.creatorId,
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
    .from(bookmarksTable)
    .leftJoin(mangaTable, eq(bookmarksTable.mangaId, mangaTable.id))
    .where(eq(bookmarksTable.userId, userId));

  res.json(rows.map(r => ({
    ...r,
    creatorName: "Creator",
    creatorAvatar: null,
    tags: r.tags ?? [],
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
  })));
});

router.get("/users/:userId/rewards", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
  if (!canView(req, userId)) { res.status(404).json({ error: "User not found" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json({
    totalPoints: user.points,
    weeklyPoints: user.weeklyPoints,
    monthlyPoints: user.monthlyPoints,
    tokens: Math.floor(user.points / 100),
    contestEntries: Math.floor(user.points / 200),
    winningHistory: [],
  });
});

router.get("/users/:userId/notifications", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
  // Notifications are private (they include purchases and payouts).
  if (!req.user || (req.user.id !== userId && req.user.role !== "admin")) { res.status(403).json({ error: "Not allowed" }); return; }

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(20);

  res.json(rows.map(r => ({
    id: r.id,
    type: r.type,
    message: r.message,
    relatedId: r.relatedId ?? null,
    isRead: r.isRead,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
  })));
});

export default router;
