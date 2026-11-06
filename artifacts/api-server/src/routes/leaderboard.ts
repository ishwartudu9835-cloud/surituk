import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, mangaTable, creatorsTable } from "@workspace/db";

const router: IRouter = Router();

const TRENDS = ["up", "down", "stable", "new"] as const;

router.get("/leaderboard/manga", async (req, res): Promise<void> => {
  const { period = "weekly", limit: lim = "20" } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(lim, 10) || 20, 50);

  const rankCol = period === "monthly" ? mangaTable.monthlyRank : mangaTable.weeklyRank;

  const rows = await db
    .select({
      mangaId: mangaTable.id,
      title: mangaTable.title,
      coverImage: mangaTable.coverImage,
      creatorId: mangaTable.creatorId,
      creatorName: creatorsTable.name,
      views: mangaTable.views,
      likes: mangaTable.likes,
      weeklyRank: mangaTable.weeklyRank,
      monthlyRank: mangaTable.monthlyRank,
    })
    .from(mangaTable)
    .leftJoin(creatorsTable, sql`${mangaTable.creatorId} = ${creatorsTable.id}`)
    .where(sql`${rankCol} IS NOT NULL`)
    .orderBy(rankCol)
    .limit(limit);

  res.json(rows.map((r, i) => ({
    rank: i + 1,
    mangaId: r.mangaId,
    title: r.title,
    coverImage: r.coverImage,
    creatorName: r.creatorName ?? "Unknown",
    views: r.views,
    likes: r.likes,
    trend: TRENDS[Math.floor(Math.random() * TRENDS.length)],
    change: Math.floor(Math.random() * 5),
  })));
});

router.get("/leaderboard/creators", async (req, res): Promise<void> => {
  const { limit: lim = "10" } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(lim, 10) || 10, 50);

  const rows = await db
    .select()
    .from(creatorsTable)
    .orderBy(desc(creatorsTable.totalViews))
    .limit(limit);

  res.json(rows.map((r, i) => ({
    rank: i + 1,
    creatorId: r.id,
    name: r.name,
    avatar: r.avatar,
    studioName: r.studioName ?? null,
    totalViews: r.totalViews,
    followers: r.followers,
    prize: i === 0 ? "$500 Prize" : i === 1 ? "$250 Prize" : i === 2 ? "$100 Prize" : null,
    trend: TRENDS[Math.floor(Math.random() * TRENDS.length)],
  })));
});

export default router;
