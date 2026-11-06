import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { loadUser } from "./lib/auth";
import { localPublicDir } from "./lib/storage";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Locally stored uploads (only used when no S3/R2 bucket is configured)
app.use("/api/files", express.static(localPublicDir(), { maxAge: "30d", immutable: true, fallthrough: false }));

app.use("/api", loadUser, router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
