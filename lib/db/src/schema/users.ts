import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  googleId: text("google_id").unique(),
  role: text("role").notNull().default("reader"), // reader | creator | admin
  creatorId: integer("creator_id"),
  displayName: text("display_name").notNull(),
  avatar: text("avatar").notNull(),
  bio: text("bio"),
  points: integer("points").notNull().default(0),
  weeklyPoints: integer("weekly_points").notNull().default(0),
  monthlyPoints: integer("monthly_points").notNull().default(0),
  rank: integer("rank"),
  completedManga: integer("completed_manga").notNull().default(0),
  isAdult: boolean("is_adult").notNull().default(false),
  favoriteGenres: text("favorite_genres").array().notNull().default([]),
  uiLanguage: text("ui_language").notNull().default("en"),
  onboarded: boolean("onboarded").notNull().default(false),
  referredBy: integer("referred_by"), // creator id whose referral link brought this user
  lastIp: text("last_ip"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
