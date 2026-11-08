import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { creatorsTable } from "./creators";

export const mangaTable = pgTable("manga", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").unique(),
  description: text("description"),
  creatorId: integer("creator_id").notNull().references(() => creatorsTable.id),
  coverImage: text("cover_image").notNull(),
  bannerImage: text("banner_image"),
  genre: text("genre").notNull(),
  tags: text("tags").array().default([]),
  language: text("language").notNull().default("English"),
  status: text("status").notNull().default("ongoing"),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  chapterCount: integer("chapter_count").notNull().default(0),
  rating: real("rating").default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  /** Unlisted by an admin (hidden from everyone except the creator and admins). */
  adminHidden: boolean("admin_hidden").notNull().default(false),
  adminNote: text("admin_note"),
  isSponsored: boolean("is_sponsored").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  isMature: boolean("is_mature").notNull().default(false),
  weeklyRank: integer("weekly_rank"),
  monthlyRank: integer("monthly_rank"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMangaSchema = createInsertSchema(mangaTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertManga = z.infer<typeof insertMangaSchema>;
export type Manga = typeof mangaTable.$inferSelect;
