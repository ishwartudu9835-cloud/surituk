import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, creatorsTable, mangaTable } from "@workspace/db";

const router: IRouter = Router();

function formatCreator(c: typeof creatorsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    studioName: c.studioName ?? null,
    avatar: c.avatar,
    banner: c.banner ?? null,
    bio: c.bio ?? null,
    totalManga: c.totalManga,
    totalViews: c.totalViews,
    totalLikes: c.totalLikes,
    followers: c.followers,
    revenue: c.revenue ?? null,
    socialLinks: {
      twitter: c.twitterUrl ?? null,
      instagram: c.instagramUrl ?? null,
      website: c.websiteUrl ?? null,
    },
    isVerified: c.isVerified,
    rank: c.rank ?? null,
    joinedAt: c.joinedAt?.toISOString() ?? new Date().toISOString(),
  };
}

router.get("/creators", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "10", 10), 50);
  const rows = await db.select().from(creatorsTable).orderBy(desc(creatorsTable.followers)).limit(limit);
  res.json(rows.map(formatCreator));
});

router.get("/creators/top", async (req, res): Promise<void> => {
  const { period = "monthly", limit: lim = "10" } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(lim, 10) || 10, 50);
  const rows = await db.select().from(creatorsTable).orderBy(desc(creatorsTable.totalViews)).limit(limit);
  res.json(rows.map(formatCreator));
});

router.get("/creators/spotlight", async (req, res): Promise<void> => {
  const [row] = await db.select().from(creatorsTable)
    .where(eq(creatorsTable.isVerified, true))
    .orderBy(desc(creatorsTable.totalViews))
    .limit(1);
  if (!row) { res.status(404).json({ error: "No creator found" }); return; }
  res.json(formatCreator(row));
});

router.get("/creators/:creatorId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.creatorId) ? req.params.creatorId[0] : req.params.creatorId;
  const creatorId = parseInt(raw, 10);
  if (isNaN(creatorId)) { res.status(400).json({ error: "Invalid creator id" }); return; }
  const [row] = await db.select().from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  if (!row) { res.status(404).json({ error: "Creator not found" }); return; }
  res.json(formatCreator(row));
});

router.get("/creators/:creatorId/analytics", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.creatorId) ? req.params.creatorId[0] : req.params.creatorId;
  const creatorId = parseInt(raw, 10);
  if (isNaN(creatorId)) { res.status(400).json({ error: "Invalid creator id" }); return; }

  const [creator] = await db.select().from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }

  const mangaRows = await db
    .select({ id: mangaTable.id, title: mangaTable.title, views: mangaTable.views })
    .from(mangaTable)
    .where(eq(mangaTable.creatorId, creatorId))
    .orderBy(desc(mangaTable.views))
    .limit(5);

  const viewsByDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toISOString().slice(0, 10),
      views: Math.floor((creator.totalViews / 7) * (0.7 + Math.random() * 0.6)),
    };
  });

  res.json({
    totalViews: creator.totalViews,
    totalReads: Math.floor(creator.totalViews * 0.8),
    totalLikes: creator.totalLikes,
    totalFollowers: creator.followers,
    weeklyViews: Math.floor(creator.totalViews * 0.15),
    monthlyViews: Math.floor(creator.totalViews * 0.45),
    viewsByDay,
    topManga: mangaRows,
  });
});

router.get("/creators/:creatorId/revenue", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.creatorId) ? req.params.creatorId[0] : req.params.creatorId;
  const creatorId = parseInt(raw, 10);
  if (isNaN(creatorId)) { res.status(400).json({ error: "Invalid creator id" }); return; }

  const [creator] = await db.select().from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }

  const total = creator.revenue ?? 0;
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      month: monthNames[d.getMonth()],
      amount: parseFloat((total / 6 * (0.5 + Math.random() * 1.0)).toFixed(2)),
    };
  });

  res.json({
    totalRevenue: total,
    adsRevenue: parseFloat((total * 0.6).toFixed(2)),
    bonusRevenue: parseFloat((total * 0.3).toFixed(2)),
    donationRevenue: parseFloat((total * 0.1).toFixed(2)),
    monthlyRevenue,
  });
});

export default router;
