import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import { config } from "./config";

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

/** Minimal signed token: base64url(payload).signature (HMAC-SHA256). */
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = crypto.createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string): (T & { exp: number }) | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
export const createSessionToken = (userId: number) => signToken({ uid: userId, t: "session" }, SESSION_TTL);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: User }
  }
}

/** Attaches req.user when a valid Bearer token is present. Never rejects. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const data = verifyToken<{ uid: number; t: string }>(header.slice(7));
    if (data?.t === "session") {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, data.uid));
      if (user) req.user = user;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ error: "Please log in first" }); return; }
  next();
}

export function requireCreator(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ error: "Please log in first" }); return; }
  if (!req.user.creatorId) { res.status(403).json({ error: "Creator account required" }); return; }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  next();
}

export function publicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    avatar: u.avatar,
    role: u.role,
    creatorId: u.creatorId,
  };
}
