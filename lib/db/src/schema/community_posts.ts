import { pgTable, text, serial, integer, smallint, timestamp, primaryKey } from "drizzle-orm/pg-core";
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
  /** Up to 4 photos attached by the creator. */
  images: text("images").array().notNull().default([]),
  /** The creator page the post was made from (posts are creator-only). */
  creatorId: integer("creator_id"),
  /** Poll posts: 2–4 choices. */
  pollOptions: text("poll_options").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommunityPostSchema = createInsertSchema(communityPostsTable).omit({ id: true, createdAt: true });
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityPost = typeof communityPostsTable.$inferSelect;

/** Replies: any logged-in reader can reply to a post. */
export const communityRepliesTable = pgTable("community_replies", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => communityPostsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One like per reader per post. */
export const communityLikesTable = pgTable("community_likes", {
  postId: integer("post_id").notNull().references(() => communityPostsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.postId, t.userId] })]);

/** One vote per reader per poll. */
export const communityPollVotesTable = pgTable("community_poll_votes", {
  postId: integer("post_id").notNull().references(() => communityPostsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  option: smallint("option").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.postId, t.userId] })]);
