import { Router, type IRouter } from "express";
import { db, mangaTable, creatorsTable, usersTable, chaptersTable, contestsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/platform", async (req, res): Promise<void> => {
  const [[mangaCount], [creatorCount], [userCount], [chapterCount], [viewSum], [contestCount]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(mangaTable).where(sql`${mangaTable.isPublished} = true`),
    db.select({ count: sql<number>`count(*)` }).from(creatorsTable).where(sql`${creatorsTable.status} = 'approved'`),
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({ count: sql<number>`count(*)` }).from(chaptersTable).innerJoin(mangaTable, sql`${chaptersTable.mangaId} = ${mangaTable.id}`).where(sql`${mangaTable.isPublished} = true`),
    db.select({ total: sql<number>`coalesce(sum(views),0)` }).from(mangaTable),
    db.select({ count: sql<number>`count(*)` }).from(contestsTable),
  ]);

  res.json({
    totalManga: Number(mangaCount?.count ?? 0),
    totalCreators: Number(creatorCount?.count ?? 0),
    totalReaders: Number(userCount?.count ?? 0),
    totalChapters: Number(chapterCount?.count ?? 0),
    totalViews: Number(viewSum?.total ?? 0),
    activeContests: Number(contestCount?.count ?? 0),
    totalPrizeDistributed: "$12,500",
  });
});

export default router;
