import { and, eq, sql } from "drizzle-orm";
import { db, reportsTable, mangaTable, chaptersTable, communityPostsTable, creatorsTable, notificationsTable } from "@workspace/db";
import { getSetting } from "./creatorProgram";
import { notifyAdmins } from "./deletion";

/**
 * Piracy safeguards
 *  1. Title blocklist: series named after famous published works (Solo Leveling, Naruto, Nagraj…) can't be created.
 *     Admins edit the list in Admin → Site settings (one title per line). Matching ignores case, spaces and punctuation.
 *  2. Report auto-hide: once AUTO_HIDE_REPORTS different people report the same story, chapter or post, it is hidden
 *     until an admin reviews it.
 */
export const DEFAULT_BLOCKED_TITLES = [
  // Japanese / Korean / Chinese hits
  "Solo Leveling", "One Piece", "Naruto", "Boruto", "Demon Slayer", "Kimetsu no Yaiba", "Jujutsu Kaisen", "Attack on Titan", "Shingeki no Kyojin",
  "Dragon Ball", "Chainsaw Man", "My Hero Academia", "Boku no Hero", "Tokyo Revengers", "Spy x Family", "Death Note", "One Punch Man",
  "Hunter x Hunter", "Tower of God", "The Beginning After the End", "Omniscient Reader", "Haikyuu", "Black Clover", "Blue Lock", "Fullmetal Alchemist",
  "Tokyo Ghoul", "Sword Art Online", "Doraemon", "Shin Chan", "Pokemon", "Detective Conan", "Vinland Saga", "Frieren", "Dandadan", "Kaiju No. 8",
  "Lookism", "Noblesse", "The God of High School", "Nano Machine", "Return of the Mount Hua Sect", "Martial Peak", "Tales of Demons and Gods",
  // Indian comics and characters
  "Nagraj", "Super Commando Dhruv", "Doga", "Bhokal", "Chacha Chaudhary", "Amar Chitra Katha",
  "Suppandi", "Shikari Shambu", "Chhota Bheem", "Motu Patlu", "Little Singham",
  // Western
  "Spider-Man", "Spiderman", "Batman", "Superman", "Wonder Woman", "Avengers", "X-Men", "Iron Man", "Captain America", "Harry Potter",
];

const norm = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export async function blockedTitles(): Promise<string[]> {
  const custom = await getSetting("blocked_titles", "");
  if (custom.trim()) return custom.split("\n").map(s => s.trim()).filter(Boolean);
  return DEFAULT_BLOCKED_TITLES;
}

/** Returns the matching blocked title, or null if the title is fine. Whole-word match. */
export async function checkTitle(title: string): Promise<string | null> {
  const t = ` ${norm(title)} `;
  for (const b of await blockedTitles()) {
    const n = norm(b);
    if (n && t.includes(` ${n} `)) return b;
  }
  return null;
}

export const titleError = (hit: string) =>
  `“${hit}” is a well-known published work, so this title can't be used. Upload only your own original stories — copied work gets accounts banned.`;

export const AUTO_HIDE_REPORTS = 3;

/** Called after every new report: hides the item once enough different people have reported it. */
export async function maybeAutoHide(targetType: string, targetId: number) {
  if (!["manga", "chapter", "post"].includes(targetType)) return;
  const [{ n }] = await db.select({ n: sql<number>`count(distinct ${reportsTable.reporterId})::int` }).from(reportsTable)
    .where(and(eq(reportsTable.targetType, targetType), eq(reportsTable.targetId, targetId), eq(reportsTable.status, "open")));
  if (n < AUTO_HIDE_REPORTS) return;

  const note = `Hidden automatically after ${n} reports — waiting for admin review.`;
  let title = "", ownerUserId: number | null = null, mangaId: number | null = null;
  if (targetType === "manga" || targetType === "chapter") {
    mangaId = targetType === "manga" ? targetId : (await db.select({ m: chaptersTable.mangaId }).from(chaptersTable).where(eq(chaptersTable.id, targetId)))[0]?.m ?? null;
    if (!mangaId) return;
    const [m] = await db.select({ title: mangaTable.title, adminHidden: mangaTable.adminHidden, creatorId: mangaTable.creatorId }).from(mangaTable).where(eq(mangaTable.id, mangaId));
    if (!m || m.adminHidden) return;
    await db.update(mangaTable).set({ adminHidden: true, adminNote: note }).where(eq(mangaTable.id, mangaId));
    title = m.title;
    ownerUserId = (await db.select({ o: creatorsTable.ownerUserId }).from(creatorsTable).where(eq(creatorsTable.id, m.creatorId)))[0]?.o ?? null;
  } else {
    const [p] = await db.select({ title: communityPostsTable.title, hidden: communityPostsTable.hidden, authorId: communityPostsTable.authorId }).from(communityPostsTable).where(eq(communityPostsTable.id, targetId));
    if (!p || p.hidden) return;
    await db.update(communityPostsTable).set({ hidden: true }).where(eq(communityPostsTable.id, targetId));
    title = p.title; ownerUserId = p.authorId;
  }
  if (ownerUserId) {
    await db.insert(notificationsTable).values({ userId: ownerUserId, type: "account", message: `"${title}" was hidden after several reports while our team reviews it. If it's your original work, you don't need to do anything — we'll restore it if the reports are wrong.` });
  }
  await notifyAdmins(`🚩 "${title}" was auto-hidden after ${n} reports. Review it in Admin → Reports.`);
}
