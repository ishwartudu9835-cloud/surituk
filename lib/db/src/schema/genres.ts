import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const genresTable = pgTable("genres", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  mangaCount: integer("manga_count").notNull().default(0),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon"),
});

export const insertGenreSchema = createInsertSchema(genresTable).omit({ id: true });
export type InsertGenre = z.infer<typeof insertGenreSchema>;
export type Genre = typeof genresTable.$inferSelect;
