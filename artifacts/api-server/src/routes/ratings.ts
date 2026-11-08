import { Router, type IRouter } from "express";
import { and, avg, count, eq } from "drizzle-orm";
import { db, mangaTable, mangaRatingsTable, creatorsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { visibleManga } from "../lib/visibility";
import { requireTrusted } from "../lib/trust";

/** 5-star story ratings: one per reader per story, changeable. Creators can't rate their own series. */
const router: IRouter = Router();
const num = (v: unknown) => parseInt(String(Array.isArray(v) ? v[0] : v), 10);

async function summary(mangaId: number) {
  const [s] = await db.select({ average: avg(mangaRatingsTable.stars), count: count() })
    .from(mangaRatingsTable).where(eq(mangaRatingsTable.mangaId, mangaId));
  const average = s?.average ? Math.round(Number(s.average) * 10) / 10 : 0;
  return { average, count: Number(s?.count ?? 0) };
}

router.get("/manga/:mangaId/rating", async (req, res): Promise<void> => {
  const mangaId = num(req.params.mangaId);
  if (!mangaId) { res.status(400).json({ error: "Invalid id" }); return; }
  const s = await summary(mangaId);
  let mine: number | null = null;
  if (req.user) {
    const [r] = await db.select({ stars: mangaRatingsTable.stars }).from(mangaRatingsTable)
      .where(and(eq(mangaRatingsTable.mangaId, mangaId), eq(mangaRatingsTable.userId, req.user.id)));
    mine = r?.stars ?? null;
  }
  res.json({ ...s, mine });
});

router.post("/manga/:mangaId/rating", requireAuth, async (req, res): Promise<void> => {
  if (!requireTrusted(req, res)) return;
  const mangaId = num(req.params.mangaId);
  const stars = num(req.body?.stars);
  if (!mangaId) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(stars >= 1 && stars <= 5)) { res.status(400).json({ error: "Choose 1 to 5 stars" }); return; }
  const [m] = await db.select({ id: mangaTable.id, creatorId: mangaTable.creatorId }).from(mangaTable)
    .innerJoin(creatorsTable, eq(mangaTable.creatorId, creatorsTable.id))
    .where(and(eq(mangaTable.id, mangaId), visibleManga(req.user)));
  if (!m) { res.status(404).json({ error: "Story not found" }); return; }
  if (req.user!.creatorId === m.creatorId) { res.status(403).json({ error: "You can't rate your own story" }); return; }

  await db.insert(mangaRatingsTable).values({ mangaId, userId: req.user!.id, stars })
    .onConflictDoUpdate({ target: [mangaRatingsTable.mangaId, mangaRatingsTable.userId], set: { stars, updatedAt: new Date() } });
  const s = await summary(mangaId);
  await db.update(mangaTable).set({ rating: s.average, ratingCount: s.count }).where(eq(mangaTable.id, mangaId));
  res.json({ ...s, mine: stars });
});

router.delete("/manga/:mangaId/rating", requireAuth, async (req, res): Promise<void> => {
  const mangaId = num(req.params.mangaId);
  await db.delete(mangaRatingsTable).where(and(eq(mangaRatingsTable.mangaId, mangaId), eq(mangaRatingsTable.userId, req.user!.id)));
  const s = await summary(mangaId);
  await db.update(mangaTable).set({ rating: s.average, ratingCount: s.count }).where(eq(mangaTable.id, mangaId));
  res.json({ ...s, mine: null });
});

export default router;
