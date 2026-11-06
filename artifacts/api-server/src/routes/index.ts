import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(mangaRouter);
router.use(chaptersRouter);
router.use(creatorsRouter);
router.use(usersRouter);
router.use(leaderboardRouter);
router.use(contestsRouter);
router.use(communityRouter);
router.use(genresRouter);
router.use(statsRouter);
router.use(authRouter);
router.use(uploadsRouter);
router.use(marketRouter);
router.use(adminRouter);

export default router;
