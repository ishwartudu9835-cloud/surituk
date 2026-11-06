import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth";
import { desc, eq } from "drizzle-orm";
import { db, communityPostsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/community/posts", async (req, res): Promise<void> => {
  const { type, limit: lim = "20" } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(lim, 10) || 20, 100);

  const query = db
    .select({
      id: communityPostsTable.id,
      type: communityPostsTable.type,
      title: communityPostsTable.title,
      content: communityPostsTable.content,
      authorId: communityPostsTable.authorId,
      authorName: usersTable.displayName,
      authorAvatar: usersTable.avatar,
      relatedMangaId: communityPostsTable.relatedMangaId,
      likes: communityPostsTable.likes,
      replies: communityPostsTable.replies,
      tags: communityPostsTable.tags,
      createdAt: communityPostsTable.createdAt,
    })
    .from(communityPostsTable)
    .leftJoin(usersTable, eq(communityPostsTable.authorId, usersTable.id))
    .orderBy(desc(communityPostsTable.createdAt))
    .limit(limit);

  const rows = type
    ? await query.where(eq(communityPostsTable.type, type))
    : await query;

  res.json(rows.map(r => ({
    ...r,
    authorName: r.authorName ?? "Unknown",
    authorAvatar: r.authorAvatar ?? "",
    relatedMangaTitle: null,
    tags: r.tags ?? [],
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
  })));
});

router.post("/community/posts", requireAuth, async (req, res): Promise<void> => {
  const { type, title, content, relatedMangaId, tags } = req.body;
  if (!type || !title || !content) {
    res.status(400).json({ error: "type, title, and content are required" });
    return;
  }

  const [post] = await db.insert(communityPostsTable).values({
    type,
    title,
    content,
    authorId: req.user!.id,
    relatedMangaId: relatedMangaId ?? null,
    tags: tags ?? [],
  }).returning();

  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));

  res.status(201).json({
    ...post,
    authorName: author?.displayName ?? "User",
    authorAvatar: author?.avatar ?? "",
    relatedMangaTitle: null,
    tags: post.tags ?? [],
    createdAt: post.createdAt.toISOString(),
  });
});

export default router;
