import { pgTable, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { mangaTable } from "./manga";

export const readingHistoryTable = pgTable("reading_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  mangaId: integer("manga_id").notNull().references(() => mangaTable.id),
  lastChapter: integer("last_chapter").notNull().default(1),
  progress: real("progress").notNull().default(0),
  isCompleted: boolean("is_completed").notNull().default(false),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReadingHistorySchema = createInsertSchema(readingHistoryTable).omit({ id: true });
export type InsertReadingHistory = z.infer<typeof insertReadingHistorySchema>;
export type ReadingHistory = typeof readingHistoryTable.$inferSelect;
