import { Router, type IRouter } from "express";
import { features } from "../lib/config";
import healthRouter from "./health";
import mangaRouter from "./manga";
import chaptersRouter from "./chapters";
import creatorsRouter from "./creators";
import usersRouter from "./users";
import leaderboardRouter from "./leaderboard";
import contestsRouter from "./contests";
import communityRouter from "./community";
import genresRouter from "./genres";
import statsRouter from "./stats";
import authRouter from "./auth";
import uploadsRouter from "./uploads";
import marketRouter from "./market";
import adminRouter from "./admin";
import subscriptionsRouter from "./subscriptions";
import studioRouter from "./studio";
import readerRouter from "./reader";
import proRouter from "./pro";
import ratingsRouter from "./ratings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(readerRouter);
router.use(proRouter);
router.use(ratingsRouter);
router.use(mangaRouter);
router.use(chaptersRouter);
router.use(creatorsRouter);
router.use(usersRouter);
router.use(leaderboardRouter);
router.use(communityRouter);
router.use(genresRouter);
router.use(statsRouter);
router.use(uploadsRouter);
router.use(adminRouter);
router.use(subscriptionsRouter);
router.use(studioRouter);

// Switched off for now (Phase 10). Code kept; enable with STORE_ENABLED / CONTESTS_ENABLED = "true".
if (features.store) router.use(marketRouter);
if (features.contests) router.use(contestsRouter);

export default router;
