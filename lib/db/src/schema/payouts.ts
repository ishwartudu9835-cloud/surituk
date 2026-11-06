import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { creatorsTable } from "./creators";

/** Creator withdrawal requests, paid manually by admin via UPI. Amount in paise. */
export const payoutsTable = pgTable("payouts", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => creatorsTable.id),
  amount: integer("amount").notNull(),
  upiId: text("upi_id").notNull(),
  status: text("status").notNull().default("requested"), // requested | paid | rejected
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export type Payout = typeof payoutsTable.$inferSelect;
