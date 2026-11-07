import { sql } from "drizzle-orm";
import { db, genresTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_GENRES = [
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
  { name: "Drama", slug: "drama", color: "#C084FC", icon: "theater" },
  { name: "Adventure", slug: "adventure", color: "#2DD4BF", icon: "compass" },
];

/** Makes sure a fresh database has the basic genres, so "New Manga" always has options. */
export async function ensureDefaultGenres() {
  try {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(genresTable);
    if (n > 0) return;
    await db.insert(genresTable).values(DEFAULT_GENRES.map(g => ({ ...g, mangaCount: 0 }))).onConflictDoNothing();
    logger.info("Inserted default genres");
  } catch (err) {
    logger.error({ err }, "Could not ensure default genres");
  }
}
