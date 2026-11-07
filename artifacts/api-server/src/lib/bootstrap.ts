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

/**
 * Small, safe, idempotent migrations run on every start, so new features work
 * on an existing database without running SQL by hand.
 */
export async function runMigrations() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_subscriptions (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creator_id integer NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_subscriptions_user_creator_idx ON creator_subscriptions (user_id, creator_id)`);
  } catch (err) {
    logger.error({ err }, "Startup migration failed");
  }
}

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
