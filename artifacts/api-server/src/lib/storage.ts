import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config, s3Enabled } from "./config";

/**
 * File storage. Uses Cloudflare R2 / any S3-compatible bucket when S3_* env vars are set,
 * otherwise saves to the local disk (fine for development, NOT for Render's free tier,
 * whose disk is wiped on every deploy).
 */
const s3 = s3Enabled
  ? new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
      forcePathStyle: true, // works with R2, Neon storage, MinIO and AWS
    })
  : null;

const safeExt = (name: string) => {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return ext.length <= 6 ? ext : "";
};

export function makeKey(folder: string, originalName: string) {
  const d = new Date();
  return `${folder}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}${safeExt(originalName)}`;
}

/** Saves a publicly viewable file (covers, chapter pages) and returns its URL. */
export async function savePublic(folder: string, file: { buffer: Buffer; originalname: string; mimetype: string }, apiBase: string) {
  const key = makeKey(folder, file.originalname);
  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket: config.s3.publicBucket, Key: key, Body: file.buffer, ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return config.s3.publicBaseUrl ? `${config.s3.publicBaseUrl}/${key}` : `${config.apiUrl || apiBase}/api/files/${key}`;
  }
  const full = path.resolve(config.uploadDir, "public", key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, file.buffer);
  return `${config.apiUrl || apiBase}/api/files/${key}`;
}

/** Saves a private file (paid book downloads). Returns the storage key, never a public URL. */
export async function savePrivate(folder: string, file: { buffer: Buffer; originalname: string; mimetype: string }) {
  const key = makeKey(folder, file.originalname);
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: config.s3.privateBucket, Key: `private/${key}`, Body: file.buffer, ContentType: file.mimetype }));
    return key;
  }
  const full = path.resolve(config.uploadDir, "private", key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, file.buffer);
  return key;
}

/** For S3: a short-lived signed URL. For local disk: null (caller streams the file). */
export async function privateDownloadUrl(key: string, downloadName: string): Promise<string | null> {
  if (!s3) return null;
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: config.s3.privateBucket,
    Key: `private/${key}`,
    ResponseContentDisposition: `attachment; filename="${downloadName.replace(/"/g, "")}"`,
  }), { expiresIn: 300 });
}

export const localPublicDir = () => path.resolve(config.uploadDir, "public");
export const localPrivatePath = (key: string) => {
  const base = path.resolve(config.uploadDir, "private");
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Invalid key");
  return full;
};

/** Streams a public file from the bucket (used when the bucket has no public URL). */
export async function getPublicObject(key: string) {
  if (!s3) return null;
  if (!/^(images|pages)\/[\w\-./]+$/.test(key) || key.includes("..")) return null;
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: config.s3.publicBucket, Key: key }));
    return { body: r.Body as NodeJS.ReadableStream, contentType: r.ContentType ?? "application/octet-stream", length: r.ContentLength };
  } catch {
    return null;
  }
}

/**
 * Where photos are stored, and whether saving + reading back actually works.
 * "local-disk" on Render means photos disappear on every deploy.
 */
export async function storageSelfTest(): Promise<{ mode: "s3" | "local-disk"; ok: boolean; persistent: boolean; publicUrl: boolean; error?: string; advice: string }> {
  if (!s3) {
    return {
      mode: "local-disk", ok: true, persistent: false, publicUrl: false,
      advice: "Photos are being saved on the server's own disk. On Render's free plan that disk is wiped on every deploy, so photos vanish. Add the S3/Neon storage variables on Render (AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET) and redeploy.",
    };
  }
  const key = "images/_health/check.txt";
  try {
    await s3.send(new PutObjectCommand({ Bucket: config.s3.publicBucket, Key: key, Body: Buffer.from(String(Date.now())), ContentType: "text/plain" }));
    const r = await s3.send(new GetObjectCommand({ Bucket: config.s3.publicBucket, Key: key }));
    await (r.Body as { transformToString?: () => Promise<string> })?.transformToString?.();
    return { mode: "s3", ok: true, persistent: true, publicUrl: !!config.s3.publicBaseUrl, advice: "Storage is working. New photos are kept permanently." };
  } catch (e) {
    const err = e as { name?: string; Code?: string; message?: string };
    return {
      mode: "s3", ok: false, persistent: true, publicUrl: !!config.s3.publicBaseUrl,
      error: `${err.name ?? err.Code ?? "Error"}: ${(err.message ?? "").slice(0, 200)}`,
      advice: "Storage is configured but not working — usually the access key was rotated/deleted or the bucket name is wrong. Update the keys on Render and redeploy.",
    };
  }
}
