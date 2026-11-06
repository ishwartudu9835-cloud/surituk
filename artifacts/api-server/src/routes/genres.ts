import { Router, type IRouter } from "express";
import { db, genresTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/genres", async (req, res): Promise<void> => {
  const rows = await db.select().from(genresTable).orderBy(genresTable.name);
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    mangaCount: r.mangaCount,
    color: r.color,
    icon: r.icon ?? null,
  })));
});

export default router;
