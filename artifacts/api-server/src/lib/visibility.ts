import { and, eq, type SQL } from "drizzle-orm";
import { mangaTable, creatorsTable, type User } from "@workspace/db";

/**
 * What the public may see: published series by approved creators.
 * 18+ series only for users who confirmed they are adults.
 * Queries using this must join creatorsTable.
 */
export function visibleManga(user?: User | null): SQL {
  const conds: SQL[] = [eq(mangaTable.isPublished, true), eq(mangaTable.adminHidden, false), eq(creatorsTable.status, "approved")];
  if (!user?.isAdult) conds.push(eq(mangaTable.isMature, false));
  return and(...conds)!;
}

/** Owners (and admins) can always see their own series, drafts included. */
export function canManage(user: User | null | undefined, creatorId: number) {
  return !!user && (user.creatorId === creatorId || user.role === "admin");
}
