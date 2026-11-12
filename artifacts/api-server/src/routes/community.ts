import { Router, type IRouter, type Request } from "express";
import { requireAuth, isApprovedCreator, hasAccess } from "../lib/auth";
import { requireTrusted } from "../lib/trust";
import { notifySubscribers } from "../lib/notify";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import {
  db, communityPostsTable, communityRepliesTable, communityLikesTable, communityPollVotesTable,
  usersTable, creatorsTable, mangaTable, mangaRatingsTable,
} from "@workspace/db";

/**
 * Community rules
 *  - Only approved creators (and admins) start posts, with up to 4 photos. Posts also show on the creator's page.
 *  - What readers can do depends on the post type:
 *      discussion   → comment + like
 *      review       → comment + like + 5-star rating of the linked story
 *      announcement → like only
 *      poll         → vote only (2–4 options, one vote each)
 *  - Readers must be "trusted" (verified email, profile set up, not blocked) — see lib/trust.ts.
 */
const router: IRouter = Router();

const TYPES = ["discussion", "review", "announcement", "poll"] as const;
type PostType = (typeof TYPES)[number];
const RULES: Record<PostType, { comments: boolean; likes: boolean; rating: boolean; poll: boolean }> = {
  discussion: { comments: true, likes: true, rating: false, poll: false },
  review: { comments: true, likes: true, rating: true, poll: false },
  announcement: { comments: false, likes: true, rating: false, poll: false },
  poll: { comments: false, likes: false, rating: false, poll: true },
};
const rulesFor = (t: string) => RULES[(TYPES as readonly string[]).includes(t) ? (t as PostType) : "discussion"];
const MAX_IMAGES = 4;

const num = (v: unknown) => parseInt(String(Array.isArray(v) ? v[0] : v), 10);
const isAdmin = (req: Request) => req.user?.role === "admin";
const canPost = (req: Request) => isAdmin(req) || (isApprovedCreator(req) && hasAccess(req, "manager"));
const isUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\/\S+$/i.test(v) && v.length < 1000;

// Per-user flood guard (in memory; resets on restart).
const hits = new Map<string, number[]>();
function allowed(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}

const postFields = {
  id: communityPostsTable.id,
  type: communityPostsTable.type,
  title: communityPostsTable.title,
  content: communityPostsTable.content,
  images: communityPostsTable.images,
  pollOptions: communityPostsTable.pollOptions,
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
  hidden: communityPostsTable.hidden,
  createdAt: communityPostsTable.createdAt,
};
type PostRow = {
  id: number; type: string; title: string; content: string; images: string[] | null; pollOptions: string[] | null; authorId: number;
  userName: string | null; userAvatar: string | null; username: string | null;
  creatorId: number | null; creatorName: string | null; creatorAvatar: string | null; creatorSlug: string | null; creatorVerified: boolean | null;
  relatedMangaId: number | null; hidden: boolean; likes: number; replies: number; tags: string[] | null; createdAt: Date;
};

function selectPosts() {
  return db.select(postFields).from(communityPostsTable)
    .leftJoin(usersTable, eq(communityPostsTable.authorId, usersTable.id))
    .leftJoin(creatorsTable, eq(communityPostsTable.creatorId, creatorsTable.id));
}

/** Everything per-viewer (likes, votes, story ratings) for a batch of posts, in a few queries. */
async function decorate(req: Request, rows: PostRow[]) {
  const ids = rows.map(r => r.id);
  const me = req.user?.id;
  const liked = new Set<number>();
  const myVote = new Map<number, number>();
  const pollCounts = new Map<number, number[]>();
  const stories = new Map<number, { id: number; title: string; slug: string | null; coverImage: string; rating: number; ratingCount: number }>();
  const myStoryRating = new Map<number, number>();

  if (ids.length && me) {
    (await db.select({ postId: communityLikesTable.postId }).from(communityLikesTable)
      .where(and(eq(communityLikesTable.userId, me), inArray(communityLikesTable.postId, ids)))).forEach(r => liked.add(r.postId));
  }
  const pollIds = rows.filter(r => r.type === "poll").map(r => r.id);
  if (pollIds.length) {
    const counts = await db.select({ postId: communityPollVotesTable.postId, option: communityPollVotesTable.option, n: sql<number>`count(*)::int` })
      .from(communityPollVotesTable).where(inArray(communityPollVotesTable.postId, pollIds))
      .groupBy(communityPollVotesTable.postId, communityPollVotesTable.option);
    for (const c of counts) {
      const arr = pollCounts.get(c.postId) ?? [0, 0, 0, 0];
      if (c.option >= 0 && c.option < 4) arr[c.option] = c.n;
      pollCounts.set(c.postId, arr);
    }
    if (me) {
      (await db.select({ postId: communityPollVotesTable.postId, option: communityPollVotesTable.option }).from(communityPollVotesTable)
        .where(and(eq(communityPollVotesTable.userId, me), inArray(communityPollVotesTable.postId, pollIds)))).forEach(r => myVote.set(r.postId, r.option));
    }
  }
  const storyIds = [...new Set(rows.filter(r => r.type === "review" && r.relatedMangaId).map(r => r.relatedMangaId!))];
  if (storyIds.length) {
    (await db.select({ id: mangaTable.id, title: mangaTable.title, slug: mangaTable.slug, coverImage: mangaTable.coverImage, rating: mangaTable.rating, ratingCount: mangaTable.ratingCount })
      .from(mangaTable).where(inArray(mangaTable.id, storyIds)))
      .forEach(m => stories.set(m.id, { ...m, rating: m.rating ?? 0 }));
    if (me) {
      (await db.select({ mangaId: mangaRatingsTable.mangaId, stars: mangaRatingsTable.stars }).from(mangaRatingsTable)
        .where(and(eq(mangaRatingsTable.userId, me), inArray(mangaRatingsTable.mangaId, storyIds)))).forEach(r => myStoryRating.set(r.mangaId, r.stars));
    }
  }

  return rows.map(r => {
    const rules = rulesFor(r.type);
    const options = (r.pollOptions ?? []).slice(0, 4);
    const story = r.relatedMangaId ? stories.get(r.relatedMangaId) ?? null : null;
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      content: r.content,
      images: r.images ?? [],
      authorId: r.authorId,
      authorName: r.creatorName ?? r.userName ?? "Unknown",
      authorAvatar: r.creatorAvatar ?? r.userAvatar ?? "",
      authorUsername: r.username,
      creatorId: r.creatorId,
      creatorSlug: r.creatorSlug,
      creatorVerified: !!r.creatorVerified,
      rules,
      likes: r.likes,
      likedByMe: liked.has(r.id),
      replies: r.replies,
      poll: rules.poll ? {
        options,
        counts: (pollCounts.get(r.id) ?? [0, 0, 0, 0]).slice(0, options.length),
        total: (pollCounts.get(r.id) ?? []).reduce((a, b) => a + b, 0),
        myVote: myVote.has(r.id) ? myVote.get(r.id)! : null,
      } : null,
      story: story ? { ...story, myRating: myStoryRating.get(story.id) ?? null } : null,
      canDelete: !!req.user && (req.user.id === r.authorId || isAdmin(req)),
      hidden: r.hidden,
      isAdminView: isAdmin(req),
      tags: r.tags ?? [],
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Who may post — and the poster's stories (for Review posts). */
router.get("/community/can-post", async (req, res): Promise<void> => {
  let stories: { id: number; title: string }[] = [];
  if (canPost(req) && req.user?.creatorId) {
    stories = await db.select({ id: mangaTable.id, title: mangaTable.title }).from(mangaTable)
      .where(and(eq(mangaTable.creatorId, req.user.creatorId), eq(mangaTable.isPublished, true))).orderBy(desc(mangaTable.updatedAt));
  }
  res.json({ canPost: canPost(req), loggedIn: !!req.user, stories });
});

router.get("/community/posts", async (req, res): Promise<void> => {
  const { type, creatorId: cid, limit: lim = "30" } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(lim, 10) || 30, 100);
  const creatorId = parseInt(cid ?? "", 10);
  const conds: SQL[] = [];
  if (type && (TYPES as readonly string[]).includes(type)) conds.push(eq(communityPostsTable.type, type));
  if (creatorId) conds.push(eq(communityPostsTable.creatorId, creatorId));
  if (!isAdmin(req)) conds.push(eq(communityPostsTable.hidden, false));
  const q = selectPosts().orderBy(desc(communityPostsTable.createdAt)).limit(limit);
  const rows = (conds.length ? await q.where(and(...conds)) : await q) as PostRow[];
  res.json(await decorate(req, rows));
});

router.post("/community/posts", requireAuth, async (req, res): Promise<void> => {
  if (!canPost(req)) { res.status(403).json({ error: "Only approved creators can start a post. You can reply to any post." }); return; }
  if ((req.user as { blocked?: boolean }).blocked) { res.status(403).json({ error: "Your account can't post right now." }); return; }
  if (!allowed(`post:${req.user!.id}`, 10, 60 * 60_000)) { res.status(429).json({ error: "Too many posts in an hour. Try again later." }); return; }
  const b = req.body ?? {};
  const type: PostType = (TYPES as readonly string[]).includes(b.type) ? b.type : "discussion";
  const title = String(b.title ?? "").trim().slice(0, 150);
  const content = String(b.content ?? "").trim().slice(0, 5000);
  const images: string[] = Array.isArray(b.images) ? b.images.filter(isUrl).slice(0, MAX_IMAGES) : [];
  const tags: string[] = Array.isArray(b.tags) ? b.tags.map((t: unknown) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 5) : [];
  if (title.length < 3) { res.status(400).json({ error: type === "poll" ? "Write your poll question" : "Please add a title" }); return; }

  let pollOptions: string[] = [];
  if (type === "poll") {
    pollOptions = (Array.isArray(b.pollOptions) ? b.pollOptions : []).map((o: unknown) => String(o ?? "").trim().slice(0, 80)).filter(Boolean);
    if (pollOptions.length < 2 || pollOptions.length > 4) { res.status(400).json({ error: "A poll needs 2 to 4 options" }); return; }
    if (new Set(pollOptions.map(o => o.toLowerCase())).size !== pollOptions.length) { res.status(400).json({ error: "Poll options must be different" }); return; }
  } else if (!content && !images.length) {
    res.status(400).json({ error: "Write something or add a photo" }); return;
  }

  let relatedMangaId: number | null = null;
  if (type === "review") {
    const sid = num(b.relatedMangaId);
    const [m] = sid ? await db.select({ id: mangaTable.id, creatorId: mangaTable.creatorId, isPublished: mangaTable.isPublished }).from(mangaTable).where(eq(mangaTable.id, sid)) : [];
    if (!m || !m.isPublished || (m.creatorId !== req.user!.creatorId && !isAdmin(req))) { res.status(400).json({ error: "Choose one of your published stories for readers to rate" }); return; }
    relatedMangaId = m.id;
  }

  const [post] = await db.insert(communityPostsTable).values({
    type, title, content, images, tags, pollOptions, relatedMangaId,
    authorId: req.user!.id,
    creatorId: req.user!.creatorId ?? null,
  }).returning();

  const [row] = await selectPosts().where(eq(communityPostsTable.id, post.id));
  if (post.creatorId) {
    const who = (row as PostRow).creatorName ?? "A creator you follow";
    const verb = type === "poll" ? "started a poll" : type === "review" ? "asked for your review" : type === "announcement" ? "made an announcement" : "posted";
    void notifySubscribers(post.creatorId, `${who} ${verb}: "${title}"`, post.id, "post");
  }
  res.status(201).json((await decorate(req, [row as PostRow]))[0]);
});

router.delete("/community/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const [post] = await db.select({ authorId: communityPostsTable.authorId }).from(communityPostsTable).where(eq(communityPostsTable.id, id));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (post.authorId !== req.user!.id && !isAdmin(req)) { res.status(403).json({ error: "Not allowed" }); return; }
  await db.delete(communityPostsTable).where(eq(communityPostsTable.id, id));
  res.json({ ok: true });
});

async function loadPostType(id: number) {
  const [p] = await db.select({ id: communityPostsTable.id, type: communityPostsTable.type, pollOptions: communityPostsTable.pollOptions }).from(communityPostsTable).where(eq(communityPostsTable.id, id));
  return p ?? null;
}

router.post("/community/posts/:id/like", requireAuth, async (req, res): Promise<void> => {
  if (!requireTrusted(req, res)) return;
  const id = num(req.params.id);
  const post = await loadPostType(id);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (!rulesFor(post.type).likes) { res.status(400).json({ error: "Likes are off for this post" }); return; }
  if (!allowed(`like:${req.user!.id}`, 60)) { res.status(429).json({ error: "Slow down a little" }); return; }
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

/* ---------------- Polls ---------------- */

router.post("/community/posts/:id/vote", requireAuth, async (req, res): Promise<void> => {
  if (!requireTrusted(req, res)) return;
  const id = num(req.params.id);
  const option = num(req.body?.option);
  const post = await loadPostType(id);
  if (!post || post.type !== "poll") { res.status(404).json({ error: "Poll not found" }); return; }
  const options = post.pollOptions ?? [];
  if (!(option >= 0 && option < options.length)) { res.status(400).json({ error: "Pick one of the options" }); return; }
  const inserted = await db.insert(communityPollVotesTable).values({ postId: id, userId: req.user!.id, option }).onConflictDoNothing().returning();
  if (!inserted.length) { res.status(409).json({ error: "You've already voted on this poll" }); return; }
  const [row] = await selectPosts().where(eq(communityPostsTable.id, id));
  res.json((await decorate(req, [row as PostRow]))[0].poll);
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
    canBlock: isAdmin(req) && req.user!.id !== r.authorId,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/community/posts/:id/replies", requireAuth, async (req, res): Promise<void> => {
  if (!requireTrusted(req, res)) return;
  const id = num(req.params.id);
  const content = String(req.body?.content ?? "").trim().slice(0, 2000);
  if (!content) { res.status(400).json({ error: "Write a comment first" }); return; }
  const post = await loadPostType(id);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (!rulesFor(post.type).comments) { res.status(400).json({ error: "Comments are off for this post" }); return; }
  if (!allowed(`reply:${req.user!.id}`, 10)) { res.status(429).json({ error: "You're commenting too fast. Wait a minute." }); return; }
  const [reply] = await db.insert(communityRepliesTable).values({ postId: id, authorId: req.user!.id, content }).returning();
  await db.update(communityPostsTable).set({ replies: sql`${communityPostsTable.replies} + 1` }).where(eq(communityPostsTable.id, id));
  const [u] = await db.select({ displayName: usersTable.displayName, avatar: usersTable.avatar, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, req.user!.id));
  res.status(201).json({
    id: reply.id, content: reply.content, authorId: reply.authorId,
    authorName: u?.displayName ?? "Reader", authorAvatar: u?.avatar ?? "", authorUsername: u?.username ?? null,
    canDelete: true, canBlock: false, createdAt: reply.createdAt.toISOString(),
  });
});

router.delete("/community/replies/:id", requireAuth, async (req, res): Promise<void> => {
  const id = num(req.params.id);
  const [r] = await db.select({ authorId: communityRepliesTable.authorId, postId: communityRepliesTable.postId }).from(communityRepliesTable).where(eq(communityRepliesTable.id, id));
  if (!r) { res.status(404).json({ error: "Comment not found" }); return; }
  if (r.authorId !== req.user!.id && !isAdmin(req)) { res.status(403).json({ error: "Not allowed" }); return; }
  await db.delete(communityRepliesTable).where(eq(communityRepliesTable.id, id));
  await db.update(communityPostsTable).set({ replies: sql`greatest(${communityPostsTable.replies} - 1, 0)` }).where(eq(communityPostsTable.id, r.postId));
  res.json({ ok: true });
});

export default router;
