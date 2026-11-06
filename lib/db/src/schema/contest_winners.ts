import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contestsTable } from "./contests";
import { usersTable } from "./users";

export const contestWinnersTable = pgTable("contest_winners", {
  id: serial("id").primaryKey(),
  contestId: integer("contest_id").notNull().references(() => contestsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  place: integer("place").notNull(),
  prize: text("prize").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContestWinnerSchema = createInsertSchema(contestWinnersTable).omit({ id: true, createdAt: true });
export type InsertContestWinner = z.infer<typeof insertContestWinnerSchema>;
export type ContestWinner = typeof contestWinnersTable.$inferSelect;
