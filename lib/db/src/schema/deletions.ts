import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Account deletion requests.
 * kind: "account" (the whole user account) or "creator" (only the creator / studio account).
 * status: scheduled -> completed | cancelled
 */
export const accountDeletionsTable = pgTable("account_deletions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  kind: text("kind").notNull(),
  creatorId: integer("creator_id"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("scheduled"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  warnedAt: timestamp("warned_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

/**
 * Minimal record kept after an account is deleted, as Indian IT Rules require registration
 * details to be preserved for 180 days after an account is cancelled. Purged automatically after that.
 */
export const deletedAccountsTable = pgTable("deleted_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  email: text("email"),
  displayName: text("display_name"),
  username: text("username"),
  creatorName: text("creator_name"),
  kind: text("kind").notNull(),
  reason: text("reason"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
  purgeAfter: timestamp("purge_after", { withTimezone: true }).notNull(),
});
