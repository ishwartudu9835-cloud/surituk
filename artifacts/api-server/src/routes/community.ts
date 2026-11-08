import { Router, type IRouter, type Request } from "express";
import { requireAuth, isApprovedCreator } from "../lib/auth";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, communityPostsTable, communityRepliesTable, communityLikesTable, usersTable, creatorsTable } from "@workspace/db";

/**
 * Community rules:
 *  - Only approved creators (and admins) can start a post, optionally with up to 4 photos.
 *  - Any logged-in reader can reply and like.
 *  - Authors (and admins) can delete their own posts and replies.
 */
const router: IRouter = Router();

const TYPES = ["discussion", "review", "announcement", "poll"] as const;
const MAX_IMAGES = 4;

const num = (v: unknown) => parseInt(String(Array.isArray(v) ? v[0] : v), 10);
const isAdmin = (req: Request) => req.user?.role === "admin";
const canPost = (req: Request) => isAdmin(req) || isApprovedCreator(req);
const isUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\/\S+$/i.test(v) && v.length < 1000;

// Simple per-user flood guard for replies (in memory; resets on restart).
const replyTimes = new Map<number, number[]>();
function replyAllowed(userId: number): boolean {
  const now = Date.now();
  const recent = (replyTimes.get(userId) ?? []).filter(t => now - t < 60_000);
  if (recent.length >= 10) return false;
  recent.push(now);
  replyTimes.set(userId, recent);
  return true;
}

const postFields = {
  id: communityPostsTable.id,
  type: communityPostsTable.type,
  title: communityPostsTable.title,
  content: communityPostsTable.content,
  images: communityPostsTable.images,
  authorId: communityPostsTable.authorId,
  userName: usersTable.displayName,
  userAvatar: usersTable.avatar,
  username: usersTable.username,
  creatorId: communityPostsTable.creatorId,
  creatorName: creatorsTable.name,
  creatorAvatar: creatorsTable.avatar,
  creatorSlug: creatorsTable.slug,
  creatorVerified: creatorsTable.isVerified,
  relatedMangaId: communityPostsTable.relatedMangaId,
  likes: communityPostsTable.likes,
  replies: communityPostsTable.replies,
  tags: communityPostsTable.tags,
  createdAt: communityPostsTable.createdAt,
};

type PostRow = {
  id: number; type: string; title: string; content: string; images: string[] | null; authorId: number;
  userName: string | null; userAvatar: string | null; username: string | null;
  creatorId: number | null; creatorName: string | null; creatorAvatar: string | null; creatorSlug: string | null; creatorVerified: boolean | null;
  relatedMangaId: number | null; likes: number; replies: number; tags: string[] | null; createdAt: Date;
};

function formatPost(r: PostRow, req: Request, liked: Set<number>) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    content: r.content,
    images: r.images ?? [],
    authorId: r.authorId,
    // Posts are shown under the creator page they came from.
    authorName: r.creatorName ?? r.userName ?? "Unknown",
    authorAvatar: r.creatorAvatar ?? r.userAvatar ?? "",
    authorUsername: r.username,
    creatorId: r.creatorId,
    creatorSlug: r.creatorSlug,
    creatorVerified: !!r.creatorVerified,
    relatedMangaId: r.relatedMangaId,
    relatedMangaTitle: null,
    likes: r.likes,
    replies: r.replies,
    likedByMe: liked.has(r.id),
    canDelete: !!req.user && (req.user.id === r.authorId || isAdmin(req)),
    tags: r.tags ?? [],
    createdAt: r.createdAt.toISOString(),
  };
}

async function likedSet(req: Request, postIds: number[]): Promise<Set<number>> {
  if (!req.user || !postIds.length) return new Set();
  const rows = await db.select({ postId: communityLikesTable.postId }).from(communityLikesTable)
    .where(and(eq(communityLikesTable.userId, req.user.id), inArray(communityLikesTable.postId, postIds)));
  return new Set(rows.map(r => r.postId));
}

/** Who may post — lets the page show "New Post" only to creators. */
router.get("/community/can-post", (req, res): void => {
  res.json({ canPost: canPost(req), loggedIn: !!req.user });
});

router.get("/community/posts", async (req, res): Promise<void> => {
  const { type, limit: lim = "30" } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(lim, 10) || 30, 100);

  const base = db.select(postFields).from(communityPostsTable)
    .leftJoin(usersTable, eq(communityPostsTable.authorId, usersTable.id))
    .leftJoin(creatorsTable, eq(communityPostsTable.creatorId, creatorsTable.id))
    .orderBy(desc(communityPostsTable.createdAt))
    .limit(limit);
  const rows = (type && TYPES.includes(type as never) ? await base.where(eq(communityPostsTable.type, type)) : await base) as PostRow[];
  const liked = await likedSet(req, rows.map(r => r.id));
  res.json(rows.map(r => formatPost(r, req, liked)));
});

router.post("/community/posts", requireAuth, async (req, res): Promise<void> => {
  if (!canPost(req)) { res.status(403).json({ error: "Only approved creators can start a post. You can reply to any post." }); return; }
  const b = req.body ?? {};
  const type = TYPES.includes(b.type) ? b.type : "discussion";
  if (type === "announcement" && !isAdmin(req) && !isApprovedCreator(req)) { res.status(403).json({ error: "Not allowed" }); return; }
  const title = String(b.title ?? "").trim().slice(0, 150);
  const content = String(b.content ?? "").trim().slice(0, 5000);
  if (title.length < 3) { res.status(400).json({ error: "Please add a title" }); return; }
  if (!content && !(Array.isArray(b.images) && b.images.length)) { res.status(400).json({ error: "Write something or add a photo" }); return; }
  const images: string[] = Array.isArray(b.images) ? b.images.filter(isUrl).slice(0, MAX_IMAGES) : [];
  const tags: string[] = Array.isArray(b.tags) ? b.tags.map((t: unknown) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 5) : [];

  const [post] = await db.insert(communityPostsTable).values({
    type, title, content, images, tags,
    authorId: req.user!.id,
    creatorId: req.user!.creatorId ?? null,
    relatedMangaId: Number.isInteger(b.relatedMangaId) ? b.relatedMangaId : null,
  }).returning();

  const [row] = await db.select(postFields).from(communityPostsTable)
    .leftJoin(usersTable, eq(communityPostsTable.authorId, usersTable.id))
    .leftJoin(creatorsTable, eq(communityPostsTable.creatorId, creatorsTable.id))
    .where(eq(communityPostsTable.id, post.id));
  res.status(201).json(formatPost(row as PostRow, req, new Set()));
});

router.delete("/community/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const [post] = await db.select({ authorId: communityPostsTable.authorId }).from(communityPostsTable).where(eq(communityPostsTable.id, id));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (post.authorId !== req.user!.id && !isAdmin(req)) { res.status(403).json({ error: "Not allowed" }); return; }
  await db.delete(communityPostsTable).where(eq(communityPostsTable.id, id));
  res.json({ ok: true });
});

router.post("/community/posts/:id/like", requireAuth, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const [post] = await db.select({ id: communityPostsTable.id }).from(communityPostsTable).where(eq(communityPostsTable.id, id));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  const inserted = await db.insert(communityLikesTable).values({ postId: id, userId: req.user!.id }).onConflictDoNothing().returning();
  if (inserted.length) {
    await db.update(communityPostsTable).set({ likes: sql`${communityPostsTable.likes} + 1` }).where(eq(communityPostsTable.id, id));
  } else {
    await db.delete(communityLikesTable).where(and(eq(communityLikesTable.postId, id), eq(communityLikesTable.userId, req.user!.id)));
    await db.update(communityPostsTable).set({ likes: sql`greatest(${communityPostsTable.likes} - 1, 0)` }).where(eq(communityPostsTable.id, id));
  }
  const [after] = await db.select({ likes: communityPostsTable.likes }).from(communityPostsTable).where(eq(communityPostsTable.id, id));
  res.json({ liked: inserted.length > 0, likes: after?.likes ?? 0 });
});

/* ---------------- Replies ---------------- */

router.get("/community/posts/:id/replies", async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const rows = await db.select({
    id: communityRepliesTable.id,
    content: communityRepliesTable.content,
    authorId: communityRepliesTable.authorId,
    authorName: usersTable.displayName,
    authorAvatar: usersTable.avatar,
    authorUsername: usersTable.username,
    createdAt: communityRepliesTable.createdAt,
  }).from(communityRepliesTable)
    .leftJoin(usersTable, eq(communityRepliesTable.authorId, usersTable.id))
    .where(eq(communityRepliesTable.postId, id))
    .orderBy(asc(communityRepliesTable.createdAt))
    .limit(500);
  res.json(rows.map(r => ({
    ...r,
    authorName: r.authorName ?? "Reader",
    authorAvatar: r.authorAvatar ?? "",
    canDelete: !!req.user && (req.user.id === r.authorId || isAdmin(req)),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/community/posts/:id/replies", requireAuth, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const content = String(req.body?.content ?? "").trim().slice(0, 2000);
  if (!content) { res.status(400).json({ error: "Write a reply first" }); return; }
  if (!replyAllowed(req.user!.id)) { res.status(429).json({ error: "You're replying too fast. Wait a minute." }); return; }
  const [post] = await db.select({ id: communityPostsTable.id }).from(communityPostsTable).where(eq(communityPostsTable.id, id));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  const [reply] = await db.insert(communityRepliesTable).values({ postId: id, authorId: req.user!.id, content }).returning();
  await db.update(communityPostsTable).set({ replies: sql`${communityPostsTable.replies} + 1` }).where(eq(communityPostsTable.id, id));
  const [u] = await db.select({ displayName: usersTable.displayName, avatar: usersTable.avatar, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, req.user!.id));
  res.status(201).json({
    id: reply.id, content: reply.content, authorId: reply.authorId,
    authorName: u?.displayName ?? "Reader", authorAvatar: u?.avatar ?? "", authorUsername: u?.username ?? null,
    canDelete: true, createdAt: reply.createdAt.toISOString(),
  });
});

router.delete("/community/replies/:id", requireAuth, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const [r] = await db.select({ authorId: communityRepliesTable.authorId, postId: communityRepliesTable.postId }).from(communityRepliesTable).where(eq(communityRepliesTable.id, id));
  if (!r) { res.status(404).json({ error: "Reply not found" }); return; }
  if (r.authorId !== req.user!.id && !isAdmin(req)) { res.status(403).json({ error: "Not allowed" }); return; }
  await db.delete(communityRepliesTable).where(eq(communityRepliesTable.id, id));
  await db.update(communityPostsTable).set({ replies: sql`greatest(${communityPostsTable.replies} - 1, 0)` }).where(eq(communityPostsTable.id, r.postId));
  res.json({ ok: true });
});

export default router;
