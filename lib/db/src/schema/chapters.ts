import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mangaTable } from "./manga";

export const chaptersTable = pgTable("chapters", {
  id: serial("id").primaryKey(),
  mangaId: integer("manga_id").notNull().references(() => mangaTable.id),
  chapterNumber: real("chapter_number").notNull(),
  title: text("title").notNull(),
  pages: text("pages").array().default([]),
  views: integer("views").notNull().default(0),
  isScheduled: boolean("is_scheduled").notNull().default(false),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  /** A new creator's first chapters wait in the admin review list (they stay live meanwhile). */
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChapterSchema = createInsertSchema(chaptersTable).omit({ id: true, createdAt: true });
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Chapter = typeof chaptersTable.$inferSelect;
