/**
 * Surituk demo seed.
 * Usage:  pnpm --filter @workspace/scripts run seed
 * WARNING: wipes all existing rows in every table before inserting demo data.
 */
import fs from "node:fs";
import path from "node:path";
import { sql, eq } from "drizzle-orm";
import {
  db,
  pool,
  creatorsTable,
  genresTable,
  mangaTable,
  chaptersTable,
  usersTable,
  contestsTable,
  contestWinnersTable,
  communityPostsTable,
  readingHistoryTable,
  bookmarksTable,
  notificationsTable,
  productsTable,
} from "@workspace/db";

const img = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);

async function main() {
  console.log("Clearing tables…");
  await db.execute(sql`TRUNCATE TABLE
    payouts, orders, products, otp_codes, creator_subscriptions, creator_applications, team_members, creator_invites, views_daily, admin_audit_log, app_settings,
    notifications, bookmarks, reading_history, community_posts, contest_winners,
    contests, chapters, manga, users, genres, creators
    RESTART IDENTITY CASCADE`);

  console.log("Seeding genres…");
  const genres = [
    { name: "Action", slug: "action", color: "#E1191F", icon: "swords" },
    { name: "Romance", slug: "romance", color: "#F472B6", icon: "heart" },
    { name: "Fantasy", slug: "fantasy", color: "#A78BFA", icon: "wand" },
    { name: "Horror", slug: "horror", color: "#64748B", icon: "skull" },
    { name: "Mythology", slug: "mythology", color: "#E8B44A", icon: "flame" },
    { name: "Sci-Fi", slug: "sci-fi", color: "#38BDF8", icon: "rocket" },
    { name: "Slice of Life", slug: "slice-of-life", color: "#34D399", icon: "coffee" },
    { name: "Comedy", slug: "comedy", color: "#FACC15", icon: "smile" },
    { name: "Mystery", slug: "mystery", color: "#FB923C", icon: "search" },
    { name: "Sports", slug: "sports", color: "#22C55E", icon: "trophy" },
  ];

  console.log("Seeding creators…");
  const creators = await db.insert(creatorsTable).values([
    { referralCode: "hiroshi2026", name: "Hiroshi Takeda", studioName: "Inkfall Studio", avatar: img("cr-hiroshi", 200, 200), banner: img("cr-hiroshi-b", 1400, 400), bio: "Action storyteller. Ten years of drawing swords, storms and stubborn heroes.", twitterUrl: "https://x.com", instagramUrl: "https://instagram.com", totalManga: 3, totalViews: 4_820_000, totalLikes: 312_000, followers: 128_400, revenue: 18_420, isVerified: true, rank: 1, joinedAt: daysAgo(720) },
    { name: "Yuki Matsumoto", studioName: "Paper Lantern", avatar: img("cr-yuki", 200, 200), banner: img("cr-yuki-b", 1400, 400), bio: "Quiet romances and loud feelings.", instagramUrl: "https://instagram.com", totalManga: 2, totalViews: 3_150_000, totalLikes: 268_000, followers: 96_200, revenue: 12_870, isVerified: true, rank: 2, joinedAt: daysAgo(560) },
    { type: "studio", city: "Ranchi", state: "Jharkhand", isRegisteredStudio: true, name: "Kalpa Comics", studioName: "Kalpa Comics", avatar: img("cr-aarav", 200, 200), banner: img("cr-aarav-b", 1400, 400), bio: "Retelling Indian myths in manga form, one panel at a time.", twitterUrl: "https://x.com", websiteUrl: "https://example.com", totalManga: 3, totalViews: 2_640_000, totalLikes: 201_000, followers: 74_900, revenue: 9_310, isVerified: true, rank: 3, joinedAt: daysAgo(410) },
    { name: "Sakura Nishi", studioName: "Night Bloom", avatar: img("cr-sakura", 200, 200), banner: img("cr-sakura-b", 1400, 400), bio: "Horror, mysteries and things that knock at 3 a.m.", totalManga: 2, totalViews: 1_980_000, totalLikes: 143_000, followers: 51_300, revenue: 6_740, isVerified: false, rank: 4, joinedAt: daysAgo(300) },
    { name: "Ryu Nakamura", studioName: "Orbit Ink", avatar: img("cr-ryu", 200, 200), banner: img("cr-ryu-b", 1400, 400), bio: "Sci-fi and sports. Mostly about people who refuse to lose.", totalManga: 2, totalViews: 1_420_000, totalLikes: 98_000, followers: 38_600, revenue: 4_980, isVerified: false, rank: 5, joinedAt: daysAgo(190) },
  ]).returning();
  const [c1, c2, c3, c4, c5] = creators.map(c => c.id);

  console.log("Seeding manga…");
  const mangaRows = [
    { title: "Crimson Thread", creatorId: c1, genre: "Action", tags: ["swords", "revenge", "found family"], description: "A swordswoman bound by a red thread of fate must cut through an empire to find the one who tied it.", views: 2_140_000, likes: 158_000, rating: 4.9, isFeatured: true, weeklyRank: 1, monthlyRank: 1, status: "ongoing" },
    { title: "Lanterns After Rain", creatorId: c2, genre: "Romance", tags: ["slow burn", "school"], description: "Two strangers share an umbrella every rainy Tuesday. Neither knows the other's name.", views: 1_760_000, likes: 141_000, rating: 4.8, isFeatured: true, weeklyRank: 2, monthlyRank: 2, status: "ongoing" },
    { title: "Shakti: The Ninth Night", creatorId: c3, genre: "Mythology", tags: ["gods", "festival", "epic"], description: "On the ninth night of the festival, a village girl wakes with a goddess's voice in her head.", views: 1_390_000, likes: 117_000, rating: 4.8, isFeatured: true, weeklyRank: 3, monthlyRank: 3, status: "ongoing" },
    { isMature: true, title: "The 3 A.M. Tenant", creatorId: c4, genre: "Horror", tags: ["apartment", "ghost"], description: "The rent is suspiciously cheap. The previous tenant never moved out.", views: 1_120_000, likes: 86_000, rating: 4.6, weeklyRank: 4, monthlyRank: 5, status: "ongoing" },
    { title: "Ashfall Knights", creatorId: c1, genre: "Fantasy", tags: ["dragons", "war"], description: "After the last dragon dies, its ashes start whispering to the knights who killed it.", views: 1_040_000, likes: 79_000, rating: 4.5, weeklyRank: 5, monthlyRank: 4, status: "ongoing" },
    { title: "Orbit 77", creatorId: c5, genre: "Sci-Fi", tags: ["space", "survival"], description: "A cleaning robot on a dead space station is the only one who remembers what happened.", views: 860_000, likes: 64_000, rating: 4.5, weeklyRank: 6, monthlyRank: 7, status: "ongoing" },
    { title: "Chai & Chapters", creatorId: c3, genre: "Slice of Life", tags: ["cafe", "books", "cozy"], description: "A tiny bookshop-café in the hills and the regulars who keep it alive.", views: 720_000, likes: 59_000, rating: 4.7, weeklyRank: 7, monthlyRank: 6, status: "ongoing" },
    { title: "The Last Over", creatorId: c5, genre: "Sports", tags: ["cricket", "underdogs"], description: "Six balls. Nineteen runs. A small-town team that nobody expected to be here.", views: 560_000, likes: 47_000, rating: 4.4, weeklyRank: 8, monthlyRank: 9, status: "ongoing" },
    { title: "Whispering Archive", creatorId: c4, genre: "Mystery", tags: ["library", "detective"], description: "Every book in the archive records the last words of whoever touched it.", views: 480_000, likes: 38_000, rating: 4.3, weeklyRank: 9, monthlyRank: 8, status: "completed" },
    { title: "Grandpa Is a Demon Lord", creatorId: c2, genre: "Comedy", tags: ["family", "isekai"], description: "Retired demon lord, current full-time grandfather. He is very bad at the second job.", views: 410_000, likes: 35_000, rating: 4.4, weeklyRank: 10, monthlyRank: 10, status: "ongoing" },
    { title: "Ravana's Mirror", creatorId: c3, genre: "Mythology", tags: ["villain", "epic"], description: "The story everyone knows, told from the other side of the mirror.", views: 330_000, likes: 29_000, rating: 4.6, status: "ongoing" },
    { title: "Iron Monsoon", creatorId: c1, genre: "Action", tags: ["mecha", "city"], description: "When the monsoon brings machines instead of rain, a delivery boy learns to pilot one.", views: 210_000, likes: 17_000, rating: 4.2, status: "hiatus" },
  ];
  const manga = await db.insert(mangaTable).values(mangaRows.map((m, i) => ({
    ...m,
    coverImage: img(`surituk-cover-${i + 1}`, 400, 560),
    bannerImage: img(`surituk-banner-${i + 1}`, 1600, 700),
    language: "English",
    chapterCount: i === 0 ? 5 : i === 1 ? 4 : i === 2 ? 3 : 0,
    createdAt: daysAgo(10 + i * 9),
    updatedAt: daysAgo(i),
  }))).returning();

  await db.insert(genresTable).values(genres.map(g => ({
    ...g,
    mangaCount: mangaRows.filter(m => m.genre === g.name).length,
  })));

  console.log("Seeding chapters…");
  const chapterTitles = [
    ["The Red Thread", "Ink on Snow", "Blade of the Ferryman", "The Empress's Knot", "Cut"],
    ["Tuesday", "Borrowed Umbrella", "A Name on the Bus Ticket", "Dry Season"],
    ["The First Lamp", "Voice in the Drum", "Ninth Night"],
  ];
  const chapters = chapterTitles.flatMap((titles, mi) =>
    titles.map((title, ci) => ({
      mangaId: manga[mi].id,
      chapterNumber: ci + 1,
      title,
      pages: Array.from({ length: 18 }, (_, p) => img(`surituk-m${mi + 1}c${ci + 1}p${p + 1}`, 800, 1200)),
      views: Math.round(manga[mi].views / (ci + 2)),
      createdAt: daysAgo((titles.length - ci) * 7),
    })),
  );
  await db.insert(chaptersTable).values(chapters);

  console.log("Seeding users…");
  const users = await db.insert(usersTable).values([
    { onboarded: true, isAdult: true, favoriteGenres: ["Action", "Fantasy"], username: "shadow_reader", email: "reader@surituk.demo", displayName: "Shadow Reader", avatar: img("user1", 100, 100), bio: "Reads in the dark. Ranks everything.", points: 12_480, weeklyPoints: 920, monthlyPoints: 3_410, rank: 1, completedManga: 34, joinedAt: daysAgo(400) },
    { onboarded: true, username: "neon_dreamer", displayName: "Neon Dreamer", avatar: img("user2", 100, 100), bio: "Sci-fi and romance, no in-between.", points: 9_870, weeklyPoints: 760, monthlyPoints: 2_880, rank: 2, completedManga: 21, joinedAt: daysAgo(310) },
    { onboarded: true, username: "midnight_ink", displayName: "Midnight Ink", avatar: img("user3", 100, 100), bio: "Aspiring artist. Collecting panels.", points: 7_340, weeklyPoints: 540, monthlyPoints: 1_960, rank: 3, completedManga: 15, joinedAt: daysAgo(150) },
  ]).returning();
  const [u1, u2, u3] = users.map(u => u.id);

  // A demo creator login (email OTP) that owns Hiroshi Takeda's studio.
  await db.insert(usersTable).values({
    onboarded: true, username: "hiroshi", email: "creator@surituk.demo", displayName: "Hiroshi Takeda",
    avatar: img("cr-hiroshi", 200, 200), role: "creator", creatorId: c1,
  });
  await db.update(creatorsTable).set({ upiId: "hiroshi@okaxis", payoutName: "Hiroshi Takeda" }).where(eq(creatorsTable.id, c1));

  console.log("Seeding contests…");
  const contests = await db.insert(contestsTable).values([
    { title: "Weekly Lore Quiz: Crimson Thread", type: "weekly_quiz", description: "Ten questions on the first arc of Crimson Thread. Fastest perfect score wins.", prizePool: "5,000 tokens", entryTokenCost: 10, startDate: daysAgo(2), endDate: daysFromNow(5), status: "active", participantCount: 1_284, rules: ["One entry per account", "20-minute time limit", "Ties broken by completion time"] },
    { title: "One-Shot Creator Cup", type: "creator_contest", description: "Publish a one-shot (max 24 pages) on the theme 'threads that bind'. Judged by readers and the Surituk team.", prizePool: "₹50,000 + homepage feature", entryTokenCost: 0, startDate: daysFromNow(7), endDate: daysFromNow(37), status: "upcoming", participantCount: 0, rules: ["Original work only", "Max 24 pages", "Any genre, any language"] },
    { title: "Monsoon Fan-Art Challenge", type: "fan_art", description: "Draw your favourite Surituk character in the rain.", prizePool: "3,000 tokens", entryTokenCost: 5, startDate: daysAgo(40), endDate: daysAgo(10), status: "ended", participantCount: 642, rules: ["Fan art of Surituk titles only", "Credit the original series"] },
  ]).returning();
  await db.insert(contestWinnersTable).values([
    { contestId: contests[2].id, userId: u3, place: 1, prize: "1,500 tokens" },
    { contestId: contests[2].id, userId: u2, place: 2, prize: "1,000 tokens" },
    { contestId: contests[2].id, userId: u1, place: 3, prize: "500 tokens" },
  ]);

  console.log("Seeding community…");
  await db.insert(communityPostsTable).values([
    { type: "announcement", title: "Welcome to Surituk!", content: "We're live. Read, create, and tell us what you want next. Creator payouts open soon.", authorId: u1, likes: 842, replies: 126, tags: ["news"], createdAt: daysAgo(6) },
    { type: "discussion", title: "Crimson Thread ch.5 — who tied the thread?", content: "My theory: it was the ferryman all along. Fight me.", authorId: u2, relatedMangaId: manga[0].id, likes: 431, replies: 88, tags: ["theory", "spoilers"], createdAt: daysAgo(3) },
    { type: "review", title: "Shakti is the best myth retelling I've read", content: "The festival chapter art is unreal. 10/10.", authorId: u3, relatedMangaId: manga[2].id, likes: 276, replies: 34, tags: ["review"], createdAt: daysAgo(2) },
    { type: "poll", title: "Which genre should get the next contest?", content: "Horror / Mythology / Sports / Romance", authorId: u1, likes: 190, replies: 57, tags: ["poll"], createdAt: daysAgo(1) },
    { type: "discussion", title: "Tips for first-time creators?", content: "Planning my first one-shot for the Creator Cup. How many pages do you thumbnail first?", authorId: u3, likes: 122, replies: 41, tags: ["creators", "help"], createdAt: daysAgo(0.5) },
  ]);

  console.log("Seeding reading history, bookmarks, notifications…");
  await db.insert(readingHistoryTable).values([
    { userId: u1, mangaId: manga[0].id, lastChapter: 4, progress: 80, lastReadAt: daysAgo(0.2) },
    { userId: u1, mangaId: manga[1].id, lastChapter: 2, progress: 50, lastReadAt: daysAgo(1) },
    { userId: u1, mangaId: manga[2].id, lastChapter: 3, progress: 100, isCompleted: true, lastReadAt: daysAgo(3) },
  ]);
  await db.insert(bookmarksTable).values([
    { userId: u1, mangaId: manga[0].id },
    { userId: u1, mangaId: manga[3].id },
    { userId: u1, mangaId: manga[6].id },
  ]);
  await db.insert(notificationsTable).values([
    { userId: u1, type: "new_chapter", message: "Crimson Thread — Chapter 5 is out!", relatedId: manga[0].id, createdAt: daysAgo(0.3) },
    { userId: u1, type: "contest", message: "Weekly Lore Quiz is live. Enter before it ends.", relatedId: contests[0].id, createdAt: daysAgo(1) },
    { userId: u1, type: "reward", message: "You earned 500 tokens in the Monsoon Fan-Art Challenge.", relatedId: contests[2].id, isRead: true, createdAt: daysAgo(9) },
    { userId: u1, type: "system", message: "Welcome to Surituk! Complete your profile to earn 50 points.", isRead: true, createdAt: daysAgo(20) },
  ]);

  console.log("Seeding store…");
  // Sample PDF for digital purchases (local-disk storage only; with R2 upload real files from Creator Studio).
  const sampleKey = "seed/sample-book.pdf";
  const uploadDir = path.resolve(import.meta.dirname, "../../artifacts/api-server", process.env.UPLOAD_DIR ?? "uploads");
  const pdfPath = path.join(uploadDir, "private", sampleKey);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  fs.writeFileSync(pdfPath, samplePdf("Surituk sample book - thank you for your purchase!"));

  await db.insert(productsTable).values([
    { creatorId: c1, title: "Crimson Thread — Volume 1", description: "Chapters 1–5 collected, plus 12 pages of bonus sketches and the author's notes.", coverImage: img("store-1", 400, 560), genre: "Action", pageCount: 186, format: "both", digitalPrice: 14900, physicalPrice: 39900, shippingFee: 6000, stock: 40, digitalFileKey: sampleKey, digitalFileName: "crimson-thread-vol1.pdf", sales: 128 },
    { creatorId: c3, title: "Shakti: The Ninth Night — Artbook", description: "Full-colour festival illustrations and character designs. Printed on matte art paper.", coverImage: img("store-2", 400, 560), genre: "Mythology", pageCount: 96, format: "physical", physicalPrice: 59900, shippingFee: 8000, stock: 25, sales: 41 },
    { creatorId: c2, title: "Lanterns After Rain — Side Stories", description: "Five short stories that happen between the main chapters.", coverImage: img("store-3", 400, 560), genre: "Romance", pageCount: 64, format: "digital", digitalPrice: 7900, digitalFileKey: sampleKey, digitalFileName: "lanterns-side-stories.pdf", sales: 212 },
    { creatorId: c4, title: "The 3 A.M. Tenant — Omnibus", description: "The complete first season in one big book. Not recommended before bed.", coverImage: img("store-4", 400, 560), genre: "Horror", pageCount: 320, format: "both", digitalPrice: 19900, physicalPrice: 69900, shippingFee: 0, stock: 15, digitalFileKey: sampleKey, digitalFileName: "3am-tenant-omnibus.pdf", sales: 67 },
    { creatorId: c3, title: "Chai & Chapters — Cozy Collection", description: "Slice-of-life one-shots from the hill-station café.", coverImage: img("store-5", 400, 560), genre: "Slice of Life", pageCount: 120, format: "digital", digitalPrice: 9900, digitalFileKey: sampleKey, digitalFileName: "chai-and-chapters.pdf", sales: 95 },
    { creatorId: c5, title: "The Last Over — Collector's Edition", description: "Hardcover with a signed bookmark. Limited print run.", coverImage: img("store-6", 400, 560), genre: "Sports", pageCount: 210, format: "physical", physicalPrice: 89900, shippingFee: 10000, stock: 10, sales: 19 },
  ]);

  console.log("Done ✔");
  console.log("Demo logins (email OTP, code shown on screen in dev): reader@surituk.demo, creator@surituk.demo");
}

/** Builds a tiny valid one-page PDF with a line of text. */
function samplePdf(text: string) {
  const safe = text.replace(/[()\\]/g, "");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 14 Tf 40 520 Td (${safe}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => pool.end());
