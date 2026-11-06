import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contestsTable = pgTable("contests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("weekly_quiz"),
  description: text("description").notNull(),
  prizePool: text("prize_pool").notNull(),
  entryTokenCost: integer("entry_token_cost").notNull().default(10),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("upcoming"),
  participantCount: integer("participant_count").notNull().default(0),
  rules: text("rules").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContestSchema = createInsertSchema(contestsTable).omit({ id: true, createdAt: true });
export type InsertContest = z.infer<typeof insertContestSchema>;
export type Contest = typeof contestsTable.$inferSelect;
