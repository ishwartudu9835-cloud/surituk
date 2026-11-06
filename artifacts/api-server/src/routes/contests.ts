import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, contestsTable, contestWinnersTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/contests", async (req, res): Promise<void> => {
  const rows = await db.select().from(contestsTable).orderBy(contestsTable.startDate);
  res.json(rows.map(r => ({
    id: r.id,
    title: r.title,
    type: r.type,
    description: r.description,
    prizePool: r.prizePool,
    entryTokenCost: r.entryTokenCost,
    startDate: r.startDate?.toISOString() ?? new Date().toISOString(),
    endDate: r.endDate?.toISOString() ?? new Date().toISOString(),
    status: r.status,
    participantCount: r.participantCount,
    rules: r.rules ?? [],
    prizes: [],
  })));
});

router.get("/contests/:contestId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.contestId) ? req.params.contestId[0] : req.params.contestId;
  const contestId = parseInt(raw, 10);
  if (isNaN(contestId)) { res.status(400).json({ error: "Invalid contest id" }); return; }

  const [r] = await db.select().from(contestsTable).where(eq(contestsTable.id, contestId));
  if (!r) { res.status(404).json({ error: "Contest not found" }); return; }

  res.json({
    id: r.id,
    title: r.title,
    type: r.type,
    description: r.description,
    prizePool: r.prizePool,
    entryTokenCost: r.entryTokenCost,
    startDate: r.startDate?.toISOString() ?? new Date().toISOString(),
    endDate: r.endDate?.toISOString() ?? new Date().toISOString(),
    status: r.status,
    participantCount: r.participantCount,
    rules: r.rules ?? [],
    prizes: [
      { place: 1, reward: "$500 + Creator Badge" },
      { place: 2, reward: "$250 + Silver Badge" },
      { place: 3, reward: "$100 + Bronze Badge" },
    ],
  });
});

router.get("/contests/:contestId/winners", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.contestId) ? req.params.contestId[0] : req.params.contestId;
  const contestId = parseInt(raw, 10);
  if (isNaN(contestId)) { res.status(400).json({ error: "Invalid contest id" }); return; }

  const rows = await db
    .select({
      place: contestWinnersTable.place,
      userId: contestWinnersTable.userId,
      prize: contestWinnersTable.prize,
      username: usersTable.username,
      avatar: usersTable.avatar,
    })
    .from(contestWinnersTable)
    .leftJoin(usersTable, eq(contestWinnersTable.userId, usersTable.id))
    .where(eq(contestWinnersTable.contestId, contestId))
    .orderBy(contestWinnersTable.place);

  res.json(rows.map(r => ({
    place: r.place,
    userId: r.userId,
    username: r.username ?? "Unknown",
    avatar: r.avatar ?? "",
    prize: r.prize,
  })));
});

export default router;
