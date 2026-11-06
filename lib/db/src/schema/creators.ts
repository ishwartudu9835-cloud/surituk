import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creatorsTable = pgTable("creators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  studioName: text("studio_name"),
  avatar: text("avatar").notNull(),
  banner: text("banner"),
  bio: text("bio"),
  twitterUrl: text("twitter_url"),
  instagramUrl: text("instagram_url"),
  websiteUrl: text("website_url"),
  totalManga: integer("total_manga").notNull().default(0),
  totalViews: integer("total_views").notNull().default(0),
  totalLikes: integer("total_likes").notNull().default(0),
  followers: integer("followers").notNull().default(0),
  revenue: real("revenue").default(0),
  isVerified: boolean("is_verified").notNull().default(false),
  upiId: text("upi_id"),
  payoutName: text("payout_name"),
  rank: integer("rank"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCreatorSchema = createInsertSchema(creatorsTable).omit({ id: true });
export type InsertCreator = z.infer<typeof insertCreatorSchema>;
export type Creator = typeof creatorsTable.$inferSelect;
