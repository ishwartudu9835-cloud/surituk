import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { requireCreator, requireAuth } from "../lib/auth";
import { savePublic, savePrivate } from "../lib/storage";

const router: IRouter = Router();

const MB = 1024 * 1024;
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * MB, files: 200 } });
const bookUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * MB, files: 1 } });

/** Check real file bytes, not just the (spoofable) mimetype. */
function sniff(buf: Buffer): "jpeg" | "png" | "gif" | "webp" | "pdf" | "zip" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return "gif";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return "zip"; // epub / cbz / zip
  return null;
}
const IMAGE_TYPES = new Set(["jpeg", "png", "gif", "webp"]);
const MIME: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", zip: "application/zip" };

const apiBase = (req: Request) => `${req.protocol}://${req.get("host")}`;

/** Turns multer errors (file too large etc.) into friendly JSON. */
const handle = (mw: (req: Request, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) =>
    mw(req, res, (err?: unknown) => {
      if (err instanceof multer.MulterError) {
        const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.code === "LIMIT_FILE_COUNT" ? "Too many files" : err.message;
        res.status(400).json({ error: msg });
        return;
      }
      if (err) { next(err); return; }
      next();
    });

// Logged-in users may upload single images (application samples, studio logo, covers) — limited per hour.
const imageHits = new Map<number, number[]>();
function imageLimitOk(userId: number) {
  const now = Date.now();
  const list = (imageHits.get(userId) ?? []).filter(t => now - t < 3_600_000);
  list.push(now);
  imageHits.set(userId, list);
  return list.length <= 60;
}

/** One image (cover, banner, logo, application sample). Field name: file */
router.post("/uploads/image", requireAuth, handle(imageUpload.single("file")), async (req, res): Promise<void> => {
  if (!req.user!.creatorId && !imageLimitOk(req.user!.id)) { res.status(429).json({ error: "Too many uploads. Try again later." }); return; }
  const f = req.file;
  if (!f) { res.status(400).json({ error: "No file uploaded" }); return; }
  const kind = sniff(f.buffer);
  if (!kind || !IMAGE_TYPES.has(kind)) { res.status(400).json({ error: "Only JPG, PNG, WEBP or GIF images are allowed" }); return; }
  const url = await savePublic("images", { ...f, mimetype: MIME[kind] }, apiBase(req));
  res.status(201).json({ url });
});

/** Profile photo for any logged-in user. Field name: file */
router.post("/uploads/avatar", requireAuth, handle(imageUpload.single("file")), async (req, res): Promise<void> => {
  const f = req.file;
  if (!f) { res.status(400).json({ error: "No file uploaded" }); return; }
  if (f.size > 5 * MB) { res.status(400).json({ error: "Photo must be under 5 MB" }); return; }
  const kind = sniff(f.buffer);
  if (!kind || !IMAGE_TYPES.has(kind)) { res.status(400).json({ error: "Only JPG, PNG, WEBP or GIF images are allowed" }); return; }
  const url = await savePublic("images", { ...f, mimetype: MIME[kind] }, apiBase(req));
  res.status(201).json({ url });
});

/** Many images (chapter pages), returned in the same order they were sent. Field name: files */
router.post("/uploads/images", requireCreator, handle(imageUpload.array("files", 200)), async (req, res): Promise<void> => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) { res.status(400).json({ error: "No files uploaded" }); return; }
  for (const f of files) {
    const kind = sniff(f.buffer);
    if (!kind || !IMAGE_TYPES.has(kind)) { res.status(400).json({ error: `${f.originalname} is not a supported image` }); return; }
  }
  const urls: string[] = [];
  for (const f of files) {
    urls.push(await savePublic("pages", { ...f, mimetype: MIME[sniff(f.buffer)!] }, apiBase(req)));
  }
  res.status(201).json({ urls });
});

/** The private book file buyers download (PDF / EPUB / CBZ). Field name: file */
router.post("/uploads/book", requireCreator, handle(bookUpload.single("file")), async (req, res): Promise<void> => {
  const f = req.file;
  if (!f) { res.status(400).json({ error: "No file uploaded" }); return; }
  const kind = sniff(f.buffer);
  if (kind !== "pdf" && kind !== "zip") { res.status(400).json({ error: "Only PDF, EPUB or CBZ files are allowed" }); return; }
  const key = await savePrivate("books", { ...f, mimetype: MIME[kind] });
  res.status(201).json({ key, fileName: f.originalname, size: f.size });
});

export default router;
