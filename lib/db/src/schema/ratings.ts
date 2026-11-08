import { pgTable, integer, smallint, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { mangaTable } from "./manga";

/** One 1–5 star rating per reader per story (they can change it). */
export const mangaRatingsTable = pgTable("manga_ratings", {
  mangaId: integer("manga_id").notNull().references(() => mangaTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  stars: smallint("stars").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.mangaId, t.userId] })]);
