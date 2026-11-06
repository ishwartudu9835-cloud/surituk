import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productsTable } from "./products";
import { creatorsTable } from "./creators";

/** One purchase. All money in paise. */
export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  merchantOrderId: text("merchant_order_id").notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  creatorId: integer("creator_id").notNull().references(() => creatorsTable.id),
  format: text("format").notNull(), // digital | physical
  quantity: integer("quantity").notNull().default(1),
  amount: integer("amount").notNull(),
  platformFee: integer("platform_fee").notNull(),
  creatorEarning: integer("creator_earning").notNull(),
  status: text("status").notNull().default("pending"), // pending | paid | failed
  fulfillment: text("fulfillment").notNull().default("none"), // none | processing | shipped | delivered
  trackingInfo: text("tracking_info"),
  shippingName: text("shipping_name"),
  shippingPhone: text("shipping_phone"),
  shippingAddress: text("shipping_address"),
  shippingCity: text("shipping_city"),
  shippingState: text("shipping_state"),
  shippingPincode: text("shipping_pincode"),
  gatewayOrderId: text("gateway_order_id"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
