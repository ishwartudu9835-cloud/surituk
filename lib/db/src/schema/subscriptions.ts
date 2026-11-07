import { pgTable, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { creatorsTable } from "./creators";

/** A reader subscribed to a creator (gets notified about new chapters, series and books). */
export const creatorSubscriptionsTable = pgTable("creator_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id").notNull().references(() => creatorsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("creator_subscriptions_user_creator_idx").on(t.userId, t.creatorId)]);

export type CreatorSubscription = typeof creatorSubscriptionsTable.$inferSelect;
