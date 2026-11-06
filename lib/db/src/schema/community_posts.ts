import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const communityPostsTable = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("discussion"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  relatedMangaId: integer("related_manga_id"),
  likes: integer("likes").notNull().default(0),
  replies: integer("replies").notNull().default(0),
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommunityPostSchema = createInsertSchema(communityPostsTable).omit({ id: true, createdAt: true });
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityPost = typeof communityPostsTable.$inferSelect;
