import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { loadUser } from "./lib/auth";
import { localPublicDir, getPublicObject } from "./lib/storage";
import { s3Enabled } from "./lib/config";

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

// Uploaded images. With S3 storage they are streamed from the bucket; otherwise from local disk (dev only).
if (s3Enabled) {
  app.get("/api/files/{*key}", async (req, res) => {
    const raw = (req.params as { key?: string | string[] }).key;
    const key = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
    const obj = await getPublicObject(key);
    if (!obj) { res.status(404).end(); return; }
    res.setHeader("Content-Type", obj.contentType);
    if (obj.length) res.setHeader("Content-Length", String(obj.length));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    obj.body.pipe(res);
  });
} else {
  app.use("/api/files", express.static(localPublicDir(), { maxAge: "30d", immutable: true, fallthrough: false }));
}

app.use("/api", loadUser, router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
