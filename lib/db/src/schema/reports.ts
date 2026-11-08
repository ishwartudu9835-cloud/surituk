import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Reports from readers: copyright, spam, abuse, adult content, etc.
 * targetType: manga | chapter | post | comment | creator | user
 */
export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  // Copyright claims
  claimantName: text("claimant_name"),
  claimantEmail: text("claimant_email"),
  originalUrl: text("original_url"),
  status: text("status").notNull().default("open"), // open | resolved | dismissed
  resolution: text("resolution"),
  resolvedBy: integer("resolved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
