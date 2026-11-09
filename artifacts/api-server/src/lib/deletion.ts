import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  db, usersTable, creatorsTable, mangaTable, chaptersTable, genresTable, readingHistoryTable, bookmarksTable,
  communityPostsTable, communityLikesTable, communityPollVotesTable, mangaRatingsTable, notificationsTable,
  creatorSubscriptionsTable, teamMembersTable, accountDeletionsTable, deletedAccountsTable,
} from "@workspace/db";
import { logger } from "./logger";

/**
 * Account deletion rules (see Privacy Policy):
 *  - Anyone can ask to delete their account. It's deleted after a 7-day cooling-off period, so a
 *    hacked or mistaken request can be cancelled. A reminder is sent 48 hours before.
 *  - A creator / studio account can only be deleted 15 days or more after it was approved.
 *    Admins are notified of every creator deletion request.
 *  - After deletion, only basic registration details are kept for 180 days (IT Rules, 2021 rule 3(1)(h)),
 *    then purged automatically.
 */
export const COOLING_OFF_DAYS = 7;
export const CREATOR_MIN_DAYS = 15;
export const KEEP_REGISTRATION_DAYS = 180;
const DAY = 86_400_000;

const DELETED_AVATAR = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2a2433"/><circle cx="32" cy="26" r="11" fill="#5b5468"/><rect x="14" y="42" width="36" height="16" rx="8" fill="#5b5468"/></svg>')}`;

/** Earliest date this creator account may be deleted (15 days after approval). */
export function creatorDeletableFrom(c: { approvedAt: Date | null; joinedAt: Date; status: string }): Date {
  const start = c.approvedAt ?? c.joinedAt;
  return new Date(start.getTime() + CREATOR_MIN_DAYS * DAY);
}

async function notify(userId: number, message: string, type = "account") {
  await db.insert(notificationsTable).values({ userId, type, message });
}

export async function notifyAdmins(message: string) {
  const admins = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.role, "admin"), eq(usersTable.banned, false)));
  if (admins.length) await db.insert(notificationsTable).values(admins.map(a => ({ userId: a.id, type: "admin", message })));
}

/** Delete one story with its chapters, bookmarks and history. */
export async function deleteStory(id: number) {
  const [m] = await db.select().from(mangaTable).where(eq(mangaTable.id, id));
  if (!m) return null;
  await db.transaction(async tx => {
    await tx.delete(readingHistoryTable).where(eq(readingHistoryTable.mangaId, id));
    await tx.delete(bookmarksTable).where(eq(bookmarksTable.mangaId, id));
    await tx.delete(chaptersTable).where(eq(chaptersTable.mangaId, id));
    await tx.update(communityPostsTable).set({ relatedMangaId: null }).where(eq(communityPostsTable.relatedMangaId, id));
    await tx.delete(mangaTable).where(eq(mangaTable.id, id));
    if (m.isPublished) {
      await tx.update(creatorsTable).set({ totalManga: sql`greatest(${creatorsTable.totalManga} - 1, 0)` }).where(eq(creatorsTable.id, m.creatorId));
      await tx.update(genresTable).set({ mangaCount: sql`greatest(${genresTable.mangaCount} - 1, 0)` }).where(eq(genresTable.name, m.genre));
    }
  });
  return m;
}

/** Remove a creator / studio: its stories, posts, team and subscribers. The person keeps a normal reader account. */
export async function runCreatorDeletion(creatorId: number, reason: string, byUserId?: number) {
  const [c] = await db.select().from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  if (!c || c.status === "deleted") return;
  const stories = await db.select({ id: mangaTable.id }).from(mangaTable).where(eq(mangaTable.creatorId, creatorId));
  for (const s of stories) await deleteStory(s.id);
  await db.delete(communityPostsTable).where(eq(communityPostsTable.creatorId, creatorId));
  await db.delete(creatorSubscriptionsTable).where(eq(creatorSubscriptionsTable.creatorId, creatorId));
  await db.delete(teamMembersTable).where(eq(teamMembersTable.creatorId, creatorId));
  await db.update(creatorsTable).set({
    status: "deleted", hidden: true, name: "Deleted creator", slug: null, bio: null, banner: null, avatar: DELETED_AVATAR,
    studioName: null, instagramUrl: null, twitterUrl: null, youtubeUrl: null, websiteUrl: null, city: null, state: null,
    followers: 0, totalManga: 0,
  }).where(eq(creatorsTable.id, creatorId));
  if (c.ownerUserId) {
    await db.update(usersTable).set({ creatorId: null, role: sql`case when ${usersTable.role} = 'admin' then 'admin' else 'reader' end` }).where(eq(usersTable.id, c.ownerUserId));
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, c.ownerUserId));
    await db.insert(deletedAccountsTable).values({
      userId: c.ownerUserId, email: u?.email ?? null, displayName: u?.displayName ?? null, username: u?.username ?? null,
      creatorName: c.name, kind: "creator", reason, purgeAfter: new Date(Date.now() + KEEP_REGISTRATION_DAYS * DAY),
    });
    if (byUserId !== c.ownerUserId) await notify(c.ownerUserId, `Your creator account "${c.name}" has been deleted. You can keep reading as a reader.`);
  }
  logger.info({ creatorId }, "creator account deleted");
}

/** Delete a whole user account: personal data is erased, comments stay as "Deleted user". */
export async function runAccountDeletion(userId: number, reason: string) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!u || u.deletedAt) return;
  if (u.creatorId) await runCreatorDeletion(u.creatorId, reason, userId);

  // Likes, votes and ratings: remove and fix the counts they fed into.
  const liked = await db.select({ postId: communityLikesTable.postId }).from(communityLikesTable).where(eq(communityLikesTable.userId, userId));
  if (liked.length) {
    await db.delete(communityLikesTable).where(eq(communityLikesTable.userId, userId));
    await db.update(communityPostsTable).set({ likes: sql`greatest(${communityPostsTable.likes} - 1, 0)` }).where(inArray(communityPostsTable.id, liked.map(l => l.postId)));
  }
  await db.delete(communityPollVotesTable).where(eq(communityPollVotesTable.userId, userId));
  const rated = await db.select({ mangaId: mangaRatingsTable.mangaId }).from(mangaRatingsTable).where(eq(mangaRatingsTable.userId, userId));
  await db.delete(mangaRatingsTable).where(eq(mangaRatingsTable.userId, userId));
  for (const r of rated) {
    await db.execute(sql`update manga set rating = coalesce((select round(avg(stars)::numeric, 1) from manga_ratings where manga_id = ${r.mangaId}), 0),
      rating_count = (select count(*) from manga_ratings where manga_id = ${r.mangaId}) where id = ${r.mangaId}`);
  }
  const subs = await db.select({ creatorId: creatorSubscriptionsTable.creatorId }).from(creatorSubscriptionsTable).where(eq(creatorSubscriptionsTable.userId, userId));
  if (subs.length) {
    await db.delete(creatorSubscriptionsTable).where(eq(creatorSubscriptionsTable.userId, userId));
    await db.update(creatorsTable).set({ followers: sql`greatest(${creatorsTable.followers} - 1, 0)` }).where(inArray(creatorsTable.id, subs.map(s => s.creatorId)));
  }
  await db.delete(bookmarksTable).where(eq(bookmarksTable.userId, userId));
  await db.delete(readingHistoryTable).where(eq(readingHistoryTable.userId, userId));
  await db.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
  await db.delete(teamMembersTable).where(eq(teamMembersTable.userId, userId));

  await db.insert(deletedAccountsTable).values({
    userId, email: u.email, displayName: u.displayName, username: u.username, kind: "account", reason,
    purgeAfter: new Date(Date.now() + KEEP_REGISTRATION_DAYS * DAY),
  });
  await db.update(usersTable).set({
    email: null, googleId: null, username: `deleted-${userId}`, displayName: "Deleted user", avatar: DELETED_AVATAR, bio: null,
    favoriteGenres: [], isAdult: false, lastIp: null, role: "reader", creatorId: null,
    banned: true, blocked: true, banReason: "Account deleted by the user", deletedAt: new Date(),
  }).where(eq(usersTable.id, userId));
  logger.info({ userId }, "user account deleted");
}

/** Run due deletions, send 48-hour reminders, purge old registration records. Safe to call often. */
export async function processDeletions() {
  const now = new Date();
  // 48-hour reminder
  const soon = await db.select().from(accountDeletionsTable).where(and(
    eq(accountDeletionsTable.status, "scheduled"), isNull(accountDeletionsTable.warnedAt),
    lte(accountDeletionsTable.scheduledFor, new Date(now.getTime() + 2 * DAY))));
  for (const d of soon) {
    await notify(d.userId, d.kind === "account"
      ? `Your Surituk account will be deleted on ${d.scheduledFor.toLocaleDateString("en-IN")}. Changed your mind? Cancel it in Settings → Account.`
      : `Your creator account will be deleted on ${d.scheduledFor.toLocaleDateString("en-IN")}, with all its stories. Cancel it in Settings → Account if you changed your mind.`);
    await db.update(accountDeletionsTable).set({ warnedAt: now }).where(eq(accountDeletionsTable.id, d.id));
  }
  // Due
  const due = await db.select().from(accountDeletionsTable).where(and(eq(accountDeletionsTable.status, "scheduled"), lte(accountDeletionsTable.scheduledFor, now)));
  for (const d of due) {
    try {
      if (d.kind === "creator" && d.creatorId) await runCreatorDeletion(d.creatorId, d.reason);
      else await runAccountDeletion(d.userId, d.reason);
      await db.update(accountDeletionsTable).set({ status: "completed", completedAt: new Date() }).where(eq(accountDeletionsTable.id, d.id));
    } catch (e) { logger.error({ err: e, id: d.id }, "deletion failed"); }
  }
  // Purge registration records older than 180 days
  await db.delete(deletedAccountsTable).where(lte(deletedAccountsTable.purgeAfter, now));
}

export function startDeletionWorker() {
  const run = () => processDeletions().catch(e => logger.error({ err: e }, "deletion worker failed"));
  setTimeout(run, 30_000);
  setInterval(run, 30 * 60_000).unref();
}
