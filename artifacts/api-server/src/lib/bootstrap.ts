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
  const steps: string[] = [
    // --- subscriptions ---
    `CREATE TABLE IF NOT EXISTS creator_subscriptions (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creator_id integer NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS creator_subscriptions_user_creator_idx ON creator_subscriptions (user_id, creator_id)`,
    // --- users ---
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_adult boolean NOT NULL DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_genres text[] NOT NULL DEFAULT '{}'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_language text NOT NULL DEFAULT 'en'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by integer`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip text`,
    // --- creators ---
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS youtube_url text`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'individual'`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS city text`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS state text`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS is_registered_studio boolean NOT NULL DEFAULT false`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS referral_code text`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS owner_user_id integer`,
    `CREATE UNIQUE INDEX IF NOT EXISTS creators_referral_code_unique ON creators (referral_code)`,
    // --- manga ---
    `ALTER TABLE manga ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true`,
    `ALTER TABLE manga ADD COLUMN IF NOT EXISTS is_mature boolean NOT NULL DEFAULT false`,
    `ALTER TABLE manga ADD COLUMN IF NOT EXISTS slug text`,
    `CREATE UNIQUE INDEX IF NOT EXISTS manga_slug_unique ON manga (slug)`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS slug text`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false`,
    // --- polls ---
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS poll_options text[] NOT NULL DEFAULT '{}'`,
    `CREATE TABLE IF NOT EXISTS community_poll_votes (
      post_id integer NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      option smallint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (post_id, user_id)
    )`,
    // --- admin powers ---
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text`,
    `ALTER TABLE manga ADD COLUMN IF NOT EXISTS admin_hidden boolean NOT NULL DEFAULT false`,
    `ALTER TABLE manga ADD COLUMN IF NOT EXISTS admin_note text`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS strikes integer NOT NULL DEFAULT 0`,
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS reports (
      id serial PRIMARY KEY,
      reporter_id integer REFERENCES users(id) ON DELETE SET NULL,
      target_type text NOT NULL,
      target_id integer NOT NULL,
      reason text NOT NULL,
      details text,
      claimant_name text,
      claimant_email text,
      original_url text,
      status text NOT NULL DEFAULT 'open',
      resolution text,
      resolved_by integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz
    )`,
    `CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC)`,
    // --- studios: roles, transfers, themes, likes, first-chapter review ---
    `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS access text NOT NULL DEFAULT 'editor'`,
    `UPDATE team_members SET access = 'owner' WHERE role = 'owner' AND access <> 'owner'`,
    `INSERT INTO team_members (creator_id, user_id, name, email, role, access, status)
       SELECT c.id, u.id, u.display_name, coalesce(u.email, ''), 'owner', 'owner', 'active'
       FROM creators c JOIN users u ON u.id = c.owner_user_id
       WHERE c.status <> 'deleted' AND NOT EXISTS (SELECT 1 FROM team_members t WHERE t.creator_id = c.id AND t.user_id = u.id)`,
    `CREATE TABLE IF NOT EXISTS ownership_transfers (
      id serial PRIMARY KEY, creator_id integer NOT NULL, from_user_id integer NOT NULL, to_user_id integer NOT NULL,
      note text, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz
    )`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS theme_color text`,
    `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false`,
    `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS uploaded_by integer`,
    `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS pages_updated_at timestamptz`,
    `CREATE TABLE IF NOT EXISTS manga_likes (
      manga_id integer NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (manga_id, user_id)
    )`,
    // --- account deletion + creator hide ---
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS approved_at timestamptz`,
    `UPDATE creators SET approved_at = joined_at WHERE approved_at IS NULL AND status = 'approved'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz`,
    `CREATE TABLE IF NOT EXISTS account_deletions (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      kind text NOT NULL,
      creator_id integer,
      reason text NOT NULL,
      status text NOT NULL DEFAULT 'scheduled',
      requested_at timestamptz NOT NULL DEFAULT now(),
      scheduled_for timestamptz NOT NULL,
      warned_at timestamptz,
      completed_at timestamptz,
      cancelled_at timestamptz
    )`,
    `CREATE TABLE IF NOT EXISTS deleted_accounts (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      email text,
      display_name text,
      username text,
      creator_name text,
      kind text NOT NULL,
      reason text,
      deleted_at timestamptz NOT NULL DEFAULT now(),
      purge_after timestamptz NOT NULL
    )`,
    // --- 5-star ratings ---
    `ALTER TABLE manga ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS manga_ratings (
      manga_id integer NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (manga_id, user_id)
    )`,
    // Old demo ratings had no real votes behind them; start from real reader ratings only.
    `UPDATE manga SET rating = 0 WHERE rating_count = 0 AND rating <> 0 AND NOT EXISTS (SELECT 1 FROM manga_ratings r WHERE r.manga_id = manga.id)`,
    // --- community: creator-only posts with photos, replies from anyone, likes ---
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}'`,
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS creator_id integer`,
    `CREATE TABLE IF NOT EXISTS community_replies (
      id serial PRIMARY KEY,
      post_id integer NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      author_id integer NOT NULL REFERENCES users(id),
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS community_replies_post_idx ON community_replies (post_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS community_likes (
      post_id integer NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (post_id, user_id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS creators_slug_unique ON creators (slug)`,
    // --- reading history ---
    `ALTER TABLE reading_history ALTER COLUMN last_chapter TYPE real`,
    `ALTER TABLE reading_history ADD COLUMN IF NOT EXISTS last_chapter_id integer`,
    `ALTER TABLE reading_history ADD COLUMN IF NOT EXISTS last_page integer NOT NULL DEFAULT 0`,
    // --- creator program ---
    `CREATE TABLE IF NOT EXISTS creator_applications (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creator_id integer,
      type text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      legal_name text NOT NULL,
      pen_name text NOT NULL,
      email text NOT NULL,
      mobile text NOT NULL,
      mobile_verified boolean NOT NULL DEFAULT false,
      city text NOT NULL,
      state text NOT NULL,
      portfolio_url text,
      sample_images text[] NOT NULL DEFAULT '{}',
      social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
      verification_code text NOT NULL,
      code_verified boolean NOT NULL DEFAULT false,
      original_work_accepted boolean NOT NULL DEFAULT false,
      studio_name text,
      studio_description text,
      studio_logo text,
      studio_banner text,
      website text,
      udyam_number text,
      gst_number text,
      team_members jsonb NOT NULL DEFAULT '[]'::jsonb,
      review_note text,
      reviewed_by integer,
      reviewed_at timestamptz,
      invite_token text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS team_members (
      id serial PRIMARY KEY,
      creator_id integer NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      user_id integer,
      name text NOT NULL,
      email text NOT NULL,
      role text NOT NULL,
      status text NOT NULL DEFAULT 'invited',
      invite_token text,
      created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS team_members_invite_token_unique ON team_members (invite_token)`,
    `CREATE TABLE IF NOT EXISTS creator_invites (
      token text PRIMARY KEY,
      created_by integer NOT NULL,
      note text,
      uses_left integer NOT NULL DEFAULT 1,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS views_daily (
      id serial PRIMARY KEY,
      day date NOT NULL,
      creator_id integer NOT NULL,
      manga_id integer NOT NULL,
      chapter_id integer NOT NULL,
      count integer NOT NULL DEFAULT 0)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS views_daily_day_chapter_idx ON views_daily (day, chapter_id)`,
    `CREATE TABLE IF NOT EXISTS admin_audit_log (
      id serial PRIMARY KEY,
      admin_user_id integer NOT NULL,
      action text NOT NULL,
      target_type text,
      target_id integer,
      details jsonb,
      created_at timestamptz NOT NULL DEFAULT now())`,
  ];
  for (const step of steps) {
    try {
      await db.execute(sql.raw(step));
    } catch (err) {
      logger.error({ err, step: step.slice(0, 80) }, "Startup migration step failed");
    }
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
