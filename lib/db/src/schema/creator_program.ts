import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { creatorsTable } from "./creators";

/** "Apply for Creator" — one row per application (a user can re-apply after rejection). */
export const creatorApplicationsTable = pgTable("creator_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id"), // pending creator row created at submit (for private drafts)
  type: text("type").notNull(), // individual | studio
  status: text("status").notNull().default("pending"), // pending | more_info | approved | rejected
  legalName: text("legal_name").notNull(),
  penName: text("pen_name").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile").notNull(),
  mobileVerified: boolean("mobile_verified").notNull().default(false),
  city: text("city").notNull(),
  state: text("state").notNull(),
  portfolioUrl: text("portfolio_url"),
  sampleImages: text("sample_images").array().notNull().default([]),
  socialLinks: jsonb("social_links").$type<{ instagram?: string; x?: string; youtube?: string; website?: string }>().notNull().default({}),
  verificationCode: text("verification_code").notNull(),
  codeVerified: boolean("code_verified").notNull().default(false),
  originalWorkAccepted: boolean("original_work_accepted").notNull().default(false),
  // studio only
  studioName: text("studio_name"),
  studioDescription: text("studio_description"),
  studioLogo: text("studio_logo"),
  studioBanner: text("studio_banner"),
  website: text("website"),
  udyamNumber: text("udyam_number"),
  gstNumber: text("gst_number"),
  teamMembers: jsonb("team_members").$type<{ name: string; email: string; role: string }[]>().notNull().default([]),
  // review
  reviewNote: text("review_note"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  inviteToken: text("invite_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** People in a studio. Invited by email; userId is filled when they accept. */
export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => creatorsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // owner | artist | writer | editor
  status: text("status").notNull().default("invited"), // invited | active
  inviteToken: text("invite_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Admin-made links: whoever applies through one is approved without review. */
export const creatorInvitesTable = pgTable("creator_invites", {
  token: text("token").primaryKey(),
  createdBy: integer("created_by").notNull(),
  note: text("note"),
  usesLeft: integer("uses_left").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Simple key/value settings (e.g. new_creator_mode = manual | auto). */
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Chapter views per day — powers leaderboards and (later) ad revenue share. */
export const viewsDailyTable = pgTable("views_daily", {
  id: serial("id").primaryKey(),
  day: date("day").notNull(),
  creatorId: integer("creator_id").notNull(),
  mangaId: integer("manga_id").notNull(),
  chapterId: integer("chapter_id").notNull(),
  count: integer("count").notNull().default(0),
}, t => [uniqueIndex("views_daily_day_chapter_idx").on(t.day, t.chapterId)]);

/** Who did what in the admin panel. */
export const adminAuditLogTable = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CreatorApplication = typeof creatorApplicationsTable.$inferSelect;
export type TeamMember = typeof teamMembersTable.$inferSelect;
