import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { creatorsTable } from "./creators";

/** A book/comic a creator sells in the Surituk Store. Prices are in paise (₹1 = 100). */
export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => creatorsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image").notNull(),
  previewImages: text("preview_images").array().default([]),
  genre: text("genre"),
  language: text("language").notNull().default("English"),
  pageCount: integer("page_count"),
  format: text("format").notNull().default("digital"), // digital | physical | both
  digitalPrice: integer("digital_price"),
  physicalPrice: integer("physical_price"),
  shippingFee: integer("shipping_fee").notNull().default(0),
  stock: integer("stock"),
  digitalFileKey: text("digital_file_key"), // private storage key (PDF/EPUB/CBZ)
  digitalFileName: text("digital_file_name"),
  status: text("status").notNull().default("active"), // active | draft | removed
  sales: integer("sales").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof productsTable.$inferSelect;
