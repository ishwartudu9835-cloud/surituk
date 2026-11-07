import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, ilike, inArray, or, sql, ne } from "drizzle-orm";
import {
  db, productsTable, ordersTable, creatorsTable, usersTable, payoutsTable, notificationsTable,
  type Order, type Product,
} from "@workspace/db";
import { config, phonepeEnabled, mockPaymentsEnabled } from "../lib/config";
import { requireAuth, requireCreator, signToken, verifyToken } from "../lib/auth";
import { createPayment, getOrderStatus, verifyWebhookAuth } from "../lib/phonepe";
import { privateDownloadUrl, localPrivatePath } from "../lib/storage";
import { notifySubscribers } from "../lib/notify";

const router: IRouter = Router();

const FORMATS = ["digital", "physical", "both"] as const;
const MIN_PRICE = 10 * 100;        // ₹10 (PhonePe minimum is ₹1)
const MAX_PRICE = 100_000 * 100;   // ₹1,00,000

const idParam = (req: Request, name: string) => {
  const raw = req.params[name];
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
};
const toPaise = (rupees: unknown) => {
  const n = Number(rupees);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const apiBase = (req: Request) => `${req.protocol}://${req.get("host")}`;

function productJson(p: Product, creator?: { name: string; avatar: string } | null) {
  return {
    id: p.id,
    creatorId: p.creatorId,
    creatorName: creator?.name ?? null,
    creatorAvatar: creator?.avatar ?? null,
    title: p.title,
    description: p.description,
    coverImage: p.coverImage,
    previewImages: p.previewImages ?? [],
    genre: p.genre,
    language: p.language,
    pageCount: p.pageCount,
    format: p.format,
    digitalPrice: p.digitalPrice,
    physicalPrice: p.physicalPrice,
    shippingFee: p.shippingFee,
    stock: p.stock,
    hasDigitalFile: Boolean(p.digitalFileKey),
    digitalFileName: p.digitalFileName,
    status: p.status,
    sales: p.sales,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Validates create/update input. Returns an error string or the clean values. */
function parseProductInput(body: Record<string, unknown>, existing?: Product) {
  const title = String(body.title ?? existing?.title ?? "").trim().slice(0, 120);
  const format = String(body.format ?? existing?.format ?? "digital") as (typeof FORMATS)[number];
  if (!title) return "Title is required";
  if (!FORMATS.includes(format)) return "Format must be digital, physical or both";

  const coverImage = String(body.coverImage ?? existing?.coverImage ?? "").trim();
  if (!/^(https?:\/\/)/.test(coverImage)) return "Please upload a cover image";

  const wantsDigital = format !== "physical";
  const wantsPhysical = format !== "digital";

  const digitalPrice = wantsDigital ? (body.digitalPrice !== undefined ? toPaise(body.digitalPrice) : existing?.digitalPrice ?? NaN) : null;
  const physicalPrice = wantsPhysical ? (body.physicalPrice !== undefined ? toPaise(body.physicalPrice) : existing?.physicalPrice ?? NaN) : null;
  const shippingFee = wantsPhysical ? (body.shippingFee !== undefined ? toPaise(body.shippingFee) : existing?.shippingFee ?? 0) : 0;

  for (const [label, v] of [["Digital price", digitalPrice], ["Print price", physicalPrice]] as const) {
    if (v === null) continue;
    if (!Number.isFinite(v) || v < MIN_PRICE || v > MAX_PRICE) return `${label} must be between ₹10 and ₹1,00,000`;
  }
  if (!Number.isFinite(shippingFee) || shippingFee < 0 || shippingFee > 2000 * 100) return "Shipping fee must be between ₹0 and ₹2,000";

  const digitalFileKey = wantsDigital ? (body.digitalFileKey !== undefined ? String(body.digitalFileKey || "") : existing?.digitalFileKey ?? "") : "";
  if (wantsDigital && !digitalFileKey) return "Please upload the book file (PDF/EPUB/CBZ) for the digital version";

  const stockRaw = body.stock !== undefined ? body.stock : existing?.stock;
  const stock = wantsPhysical ? (stockRaw === null || stockRaw === "" || stockRaw === undefined ? null : Math.max(0, Math.floor(Number(stockRaw)))) : null;
  if (stock !== null && !Number.isFinite(stock)) return "Stock must be a number";

  const previewImages = Array.isArray(body.previewImages)
    ? (body.previewImages as unknown[]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 8)
    : existing?.previewImages ?? [];

  const status = String(body.status ?? existing?.status ?? "active");
  if (!["active", "draft", "removed"].includes(status)) return "Invalid status";

  return {
    title,
    description: String(body.description ?? existing?.description ?? "").trim().slice(0, 3000) || null,
    coverImage,
    previewImages,
    genre: String(body.genre ?? existing?.genre ?? "").trim().slice(0, 40) || null,
    language: String(body.language ?? existing?.language ?? "English").trim().slice(0, 40),
    pageCount: body.pageCount !== undefined && body.pageCount !== "" ? Math.max(0, Math.floor(Number(body.pageCount))) || null : existing?.pageCount ?? null,
    format,
    digitalPrice,
    physicalPrice,
    shippingFee,
    stock,
    digitalFileKey: digitalFileKey || null,
    digitalFileName: wantsDigital ? String(body.digitalFileName ?? existing?.digitalFileName ?? "book").slice(0, 120) : null,
    status,
  };
}

/* ======================= Public catalogue ======================= */

router.get("/market/products", async (req, res): Promise<void> => {
  const { search, format, genre, creatorId, sort } = req.query as Record<string, string | undefined>;
  const conds = [eq(productsTable.status, "active")];
  if (search) conds.push(or(ilike(productsTable.title, `%${search}%`), ilike(creatorsTable.name, `%${search}%`))!);
  if (format === "digital") conds.push(ne(productsTable.format, "physical"));
  if (format === "physical") conds.push(ne(productsTable.format, "digital"));
  if (genre) conds.push(eq(productsTable.genre, genre));
  if (creatorId) conds.push(eq(productsTable.creatorId, Number(creatorId)));

  const order = sort === "popular" ? desc(productsTable.sales)
    : sort === "price" ? sql`coalesce(${productsTable.digitalPrice}, ${productsTable.physicalPrice})`
    : desc(productsTable.createdAt);

  const rows = await db.select({ p: productsTable, c: { name: creatorsTable.name, avatar: creatorsTable.avatar } })
    .from(productsTable).leftJoin(creatorsTable, eq(productsTable.creatorId, creatorsTable.id))
    .where(and(...conds)).orderBy(order).limit(100);
  res.json(rows.map(r => productJson(r.p, r.c)));
});

router.get("/market/products/:id", async (req, res): Promise<void> => {
  const id = idParam(req, "id");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [r] = await db.select({ p: productsTable, c: { name: creatorsTable.name, avatar: creatorsTable.avatar } })
    .from(productsTable).leftJoin(creatorsTable, eq(productsTable.creatorId, creatorsTable.id))
    .where(eq(productsTable.id, id));
  if (!r || r.p.status === "removed") { res.status(404).json({ error: "Book not found" }); return; }

  let owned = false;
  if (req.user) {
    const [o] = await db.select({ id: ordersTable.id }).from(ordersTable).where(and(
      eq(ordersTable.userId, req.user.id), eq(ordersTable.productId, id), eq(ordersTable.status, "paid"), eq(ordersTable.format, "digital"),
    )).limit(1);
    owned = Boolean(o);
  }
  res.json({ ...productJson(r.p, r.c), ownedDigital: owned, isMine: req.user?.creatorId === r.p.creatorId });
});

/* ======================= Creator: manage books ======================= */

router.get("/market/my-products", requireCreator, async (req, res): Promise<void> => {
  const rows = await db.select().from(productsTable)
    .where(and(eq(productsTable.creatorId, req.user!.creatorId!), ne(productsTable.status, "removed")))
    .orderBy(desc(productsTable.createdAt));
  res.json(rows.map(p => productJson(p)));
});

router.post("/market/products", requireCreator, async (req, res): Promise<void> => {
  const v = parseProductInput(req.body ?? {});
  if (typeof v === "string") { res.status(400).json({ error: v }); return; }
  const [p] = await db.insert(productsTable).values({ ...v, creatorId: req.user!.creatorId! }).returning();
  if (p.status === "active") {
    const [c] = await db.select({ name: creatorsTable.name }).from(creatorsTable).where(eq(creatorsTable.id, p.creatorId));
    void notifySubscribers(p.creatorId, `${c?.name ?? "A creator you follow"} released a new book in the Store: "${p.title}"`, p.id);
  }
  res.status(201).json(productJson(p));
});

router.patch("/market/products/:id", requireCreator, async (req, res): Promise<void> => {
  const id = idParam(req, "id");
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing || existing.creatorId !== req.user!.creatorId) { res.status(404).json({ error: "Book not found" }); return; }
  const v = parseProductInput(req.body ?? {}, existing);
  if (typeof v === "string") { res.status(400).json({ error: v }); return; }
  const [p] = await db.update(productsTable).set({ ...v, updatedAt: new Date() }).where(eq(productsTable.id, id)).returning();
  res.json(productJson(p));
});

/* ======================= Checkout & payments ======================= */

async function notify(userId: number, message: string, relatedId?: number) {
  await db.insert(notificationsTable).values({ userId, type: "system", message, relatedId: relatedId ?? null });
}

/** Idempotent: only the first call for a pending order does anything. */
async function markPaid(order: Order, gatewayOrderId?: string) {
  const [updated] = await db.update(ordersTable)
    .set({ status: "paid", paidAt: new Date(), gatewayOrderId: gatewayOrderId ?? order.gatewayOrderId, fulfillment: order.format === "physical" ? "processing" : "none" })
    .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "pending")))
    .returning();
  if (!updated) return;

  await db.update(productsTable).set({
    sales: sql`${productsTable.sales} + ${updated.quantity}`,
    ...(updated.format === "physical" ? { stock: sql`case when ${productsTable.stock} is null then null else greatest(${productsTable.stock} - ${updated.quantity}, 0) end` } : {}),
  }).where(eq(productsTable.id, updated.productId));

  const [p] = await db.select({ title: productsTable.title }).from(productsTable).where(eq(productsTable.id, updated.productId));
  await notify(updated.userId, updated.format === "digital"
    ? `Payment successful! "${p?.title}" is now in your Library.`
    : `Order confirmed for "${p?.title}". The creator will ship it soon.`, updated.productId);
  const sellers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.creatorId, updated.creatorId));
  for (const s of sellers) {
    await notify(s.id, `New sale: "${p?.title}" (${updated.format}) — you earn ₹${(updated.creatorEarning / 100).toFixed(2)}`, updated.productId);
  }
}

async function syncWithGateway(order: Order): Promise<Order> {
  if (order.status !== "pending" || !phonepeEnabled) return order;
  const st = await getOrderStatus(order.merchantOrderId);
  if (st.state === "COMPLETED" && st.amount === order.amount) await markPaid(order, st.orderId);
  else if (st.state === "FAILED") await db.update(ordersTable).set({ status: "failed" }).where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "pending")));
  const [fresh] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id));
  return fresh;
}

router.post("/market/checkout", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const productId = Number(req.body?.productId);
  const format = String(req.body?.format ?? "");
  const quantity = format === "physical" ? Math.min(Math.max(Math.floor(Number(req.body?.quantity ?? 1)) || 1, 1), 10) : 1;
  if (format !== "digital" && format !== "physical") { res.status(400).json({ error: "Choose digital or print" }); return; }

  const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!p || p.status !== "active") { res.status(404).json({ error: "This book is not available" }); return; }
  if (p.creatorId === user.creatorId) { res.status(400).json({ error: "You can't buy your own book" }); return; }
  if (format === "digital" && (p.format === "physical" || !p.digitalPrice || !p.digitalFileKey)) { res.status(400).json({ error: "Digital version not available" }); return; }
  if (format === "physical" && (p.format === "digital" || !p.physicalPrice)) { res.status(400).json({ error: "Print version not available" }); return; }
  if (format === "physical" && p.stock !== null && p.stock < quantity) { res.status(400).json({ error: p.stock === 0 ? "Out of stock" : `Only ${p.stock} left in stock` }); return; }

  if (format === "digital") {
    const [owned] = await db.select({ id: ordersTable.id }).from(ordersTable).where(and(
      eq(ordersTable.userId, user.id), eq(ordersTable.productId, p.id), eq(ordersTable.format, "digital"), eq(ordersTable.status, "paid"),
    )).limit(1);
    if (owned) { res.status(409).json({ error: "You already own this book — open it from your Library" }); return; }
  }

  let shipping: Record<string, string> = {};
  if (format === "physical") {
    const s = req.body?.shipping ?? {};
    shipping = {
      shippingName: String(s.name ?? "").trim().slice(0, 80),
      shippingPhone: String(s.phone ?? "").replace(/\D/g, "").slice(-10),
      shippingAddress: String(s.address ?? "").trim().slice(0, 300),
      shippingCity: String(s.city ?? "").trim().slice(0, 60),
      shippingState: String(s.state ?? "").trim().slice(0, 60),
      shippingPincode: String(s.pincode ?? "").replace(/\D/g, ""),
    };
    if (!shipping.shippingName || !shipping.shippingAddress || !shipping.shippingCity || !shipping.shippingState) { res.status(400).json({ error: "Please fill the full delivery address" }); return; }
    if (shipping.shippingPhone.length !== 10) { res.status(400).json({ error: "Enter a 10-digit mobile number" }); return; }
    if (!/^\d{6}$/.test(shipping.shippingPincode)) { res.status(400).json({ error: "Enter a valid 6-digit PIN code" }); return; }
  }

  // Price is always computed on the server — never trust the browser.
  const itemTotal = (format === "digital" ? p.digitalPrice! : p.physicalPrice!) * quantity;
  const amount = itemTotal + (format === "physical" ? p.shippingFee : 0);
  // Commission is taken on the book price; shipping goes fully to the creator who ships it.
  const platformFee = Math.round(itemTotal * config.commissionPercent / 100);
  const creatorEarning = amount - platformFee;

  const merchantOrderId = `SRT-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const [order] = await db.insert(ordersTable).values({
    merchantOrderId, userId: user.id, productId: p.id, creatorId: p.creatorId, format, quantity,
    amount, platformFee, creatorEarning, ...shipping,
  }).returning();

  const returnUrl = `${config.frontendUrl}/payment/status?order=${merchantOrderId}`;

  if (phonepeEnabled) {
    try {
      const pay = await createPayment({ merchantOrderId, amountPaise: amount, redirectUrl: returnUrl, udf1: String(order.id) });
      await db.update(ordersTable).set({ gatewayOrderId: pay.orderId }).where(eq(ordersTable.id, order.id));
      res.json({ redirectUrl: pay.redirectUrl, merchantOrderId });
    } catch (err) {
      req.log.error({ err }, "phonepe create payment failed");
      await db.update(ordersTable).set({ status: "failed" }).where(eq(ordersTable.id, order.id));
      res.status(502).json({ error: "Payment gateway error. Please try again." });
    }
    return;
  }
  if (mockPaymentsEnabled) {
    res.json({ redirectUrl: `${config.frontendUrl}/payment/mock?order=${merchantOrderId}`, merchantOrderId, mock: true });
    return;
  }
  await db.update(ordersTable).set({ status: "failed" }).where(eq(ordersTable.id, order.id));
  res.status(503).json({ error: "Payments are not set up yet" });
});

async function orderView(order: Order) {
  const [p] = await db.select().from(productsTable).where(eq(productsTable.id, order.productId));
  return {
    id: order.id,
    merchantOrderId: order.merchantOrderId,
    productId: order.productId,
    productTitle: p?.title ?? "Book",
    coverImage: p?.coverImage ?? "",
    format: order.format,
    quantity: order.quantity,
    amount: order.amount,
    status: order.status,
    fulfillment: order.fulfillment,
    trackingInfo: order.trackingInfo,
    canDownload: order.status === "paid" && order.format === "digital" && Boolean(p?.digitalFileKey),
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}

/** Called by the payment-status page after PhonePe redirects the buyer back. */
router.get("/market/orders/by-ref/:ref", requireAuth, async (req, res): Promise<void> => {
  const ref = String(req.params.ref);
  let [order] = await db.select().from(ordersTable).where(eq(ordersTable.merchantOrderId, ref));
  if (!order || order.userId !== req.user!.id) { res.status(404).json({ error: "Order not found" }); return; }
  try { order = await syncWithGateway(order); } catch (err) { req.log.warn({ err }, "status check failed"); }
  res.json(await orderView(order));
});

/** Local testing only: pretend the payment succeeded/failed. */
router.post("/market/orders/by-ref/:ref/mock-pay", requireAuth, async (req, res): Promise<void> => {
  if (!mockPaymentsEnabled) { res.status(404).json({ error: "Not available" }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.merchantOrderId, String(req.params.ref)));
  if (!order || order.userId !== req.user!.id) { res.status(404).json({ error: "Order not found" }); return; }
  if (req.body?.result === "success") await markPaid(order, "MOCK");
  else await db.update(ordersTable).set({ status: "failed" }).where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "pending")));
  const [fresh] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id));
  res.json(await orderView(fresh));
});

/** PhonePe server-to-server webhook. We re-check status with PhonePe instead of trusting the body. */
router.post("/payments/phonepe/webhook", async (req, res): Promise<void> => {
  if (!verifyWebhookAuth(req.headers.authorization)) { res.status(401).json({ error: "unauthorized" }); return; }
  const ref = req.body?.payload?.merchantOrderId as string | undefined;
  if (ref) {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.merchantOrderId, ref));
    if (order) {
      try { await syncWithGateway(order); } catch (err) { req.log.error({ err }, "webhook sync failed"); res.status(500).end(); return; }
    }
  }
  res.json({ ok: true });
});

/* ======================= Buyer: library & orders ======================= */

router.get("/market/my-orders", requireAuth, async (req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.userId, req.user!.id), inArray(ordersTable.status, ["paid", "pending"])))
    .orderBy(desc(ordersTable.createdAt)).limit(200);
  res.json(await Promise.all(orders.map(orderView)));
});

router.post("/market/orders/:id/download-link", requireAuth, async (req, res): Promise<void> => {
  const id = idParam(req, "id");
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order || order.userId !== req.user!.id || order.status !== "paid" || order.format !== "digital") {
    res.status(404).json({ error: "Purchase not found" }); return;
  }
  const token = signToken({ t: "dl", oid: order.id }, 300);
  res.json({ url: `${config.apiUrl || apiBase(req)}/api/market/download/${token}` });
});

router.get("/market/download/:token", async (req, res): Promise<void> => {
  const data = verifyToken<{ t: string; oid: number }>(String(req.params.token));
  if (!data || data.t !== "dl") { res.status(410).send("This download link has expired. Open your Library and try again."); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, data.oid));
  const [p] = order ? await db.select().from(productsTable).where(eq(productsTable.id, order.productId)) : [];
  if (!order || order.status !== "paid" || !p?.digitalFileKey) { res.status(404).send("Not found"); return; }

  const ext = path.extname(p.digitalFileName ?? "") || path.extname(p.digitalFileKey) || ".pdf";
  const name = `${p.title.replace(/[^\w\- ]+/g, " ").replace(/\s+/g, " ").trim() || "book"}${ext}`;
  const signed = await privateDownloadUrl(p.digitalFileKey, name);
  if (signed) { res.redirect(302, signed); return; }

  const file = localPrivatePath(p.digitalFileKey);
  if (!fs.existsSync(file)) { res.status(404).send("File missing"); return; }
  res.download(file, name);
});

/* ======================= Creator: sales, shipping, payouts ======================= */

async function creatorBalance(creatorId: number) {
  // Digital sales count immediately; print sales once the creator marks them shipped.
  const [earned] = await db.select({
    total: sql<number>`coalesce(sum(${ordersTable.creatorEarning}), 0)::int`,
    gross: sql<number>`coalesce(sum(${ordersTable.amount}), 0)::int`,
    count: sql<number>`count(*)::int`,
  }).from(ordersTable).where(and(eq(ordersTable.creatorId, creatorId), eq(ordersTable.status, "paid")));
  const [cleared] = await db.select({ total: sql<number>`coalesce(sum(${ordersTable.creatorEarning}), 0)::int` })
    .from(ordersTable).where(and(
      eq(ordersTable.creatorId, creatorId), eq(ordersTable.status, "paid"),
      or(eq(ordersTable.format, "digital"), inArray(ordersTable.fulfillment, ["shipped", "delivered"])),
    ));
  const [withdrawn] = await db.select({ total: sql<number>`coalesce(sum(${payoutsTable.amount}), 0)::int` })
    .from(payoutsTable).where(and(eq(payoutsTable.creatorId, creatorId), inArray(payoutsTable.status, ["requested", "paid"])));
  return {
    totalSales: earned.count,
    grossSales: earned.gross,
    totalEarnings: earned.total,
    clearedEarnings: cleared.total,
    withdrawn: withdrawn.total,
    available: Math.max(cleared.total - withdrawn.total, 0),
    commissionPercent: config.commissionPercent,
    minPayout: config.minPayoutPaise,
  };
}

router.get("/market/creator/summary", requireCreator, async (req, res): Promise<void> => {
  res.json(await creatorBalance(req.user!.creatorId!));
});

router.get("/market/creator/orders", requireCreator, async (req, res): Promise<void> => {
  const rows = await db.select({ o: ordersTable, title: productsTable.title, buyer: usersTable.displayName })
    .from(ordersTable)
    .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(and(eq(ordersTable.creatorId, req.user!.creatorId!), eq(ordersTable.status, "paid")))
    .orderBy(desc(ordersTable.paidAt)).limit(300);
  res.json(rows.map(({ o, title, buyer }) => ({
    id: o.id,
    merchantOrderId: o.merchantOrderId,
    productTitle: title,
    buyerName: buyer,
    format: o.format,
    quantity: o.quantity,
    amount: o.amount,
    platformFee: o.platformFee,
    creatorEarning: o.creatorEarning,
    fulfillment: o.fulfillment,
    trackingInfo: o.trackingInfo,
    shipping: o.format === "physical" ? {
      name: o.shippingName, phone: o.shippingPhone, address: o.shippingAddress,
      city: o.shippingCity, state: o.shippingState, pincode: o.shippingPincode,
    } : null,
    paidAt: o.paidAt?.toISOString() ?? null,
  })));
});

router.patch("/market/creator/orders/:id", requireCreator, async (req, res): Promise<void> => {
  const id = idParam(req, "id");
  const fulfillment = String(req.body?.fulfillment ?? "");
  if (!["processing", "shipped", "delivered"].includes(fulfillment)) { res.status(400).json({ error: "Invalid status" }); return; }
  const trackingInfo = String(req.body?.trackingInfo ?? "").trim().slice(0, 200) || null;
  const [o] = await db.update(ordersTable).set({ fulfillment, ...(trackingInfo ? { trackingInfo } : {}) })
    .where(and(eq(ordersTable.id, id), eq(ordersTable.creatorId, req.user!.creatorId!), eq(ordersTable.format, "physical"), eq(ordersTable.status, "paid")))
    .returning();
  if (!o) { res.status(404).json({ error: "Order not found" }); return; }
  if (fulfillment === "shipped") await notify(o.userId, `Your order ${o.merchantOrderId} has been shipped.${trackingInfo ? ` Tracking: ${trackingInfo}` : ""}`, o.productId);
  res.json({ ok: true });
});

router.get("/market/creator/payouts", requireCreator, async (req, res): Promise<void> => {
  const rows = await db.select().from(payoutsTable).where(eq(payoutsTable.creatorId, req.user!.creatorId!)).orderBy(desc(payoutsTable.createdAt));
  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), paidAt: r.paidAt?.toISOString() ?? null })));
});

router.post("/market/creator/payouts", requireCreator, async (req, res): Promise<void> => {
  const creatorId = req.user!.creatorId!;
  const [creator] = await db.select().from(creatorsTable).where(eq(creatorsTable.id, creatorId));
  if (!creator?.upiId) { res.status(400).json({ error: "Add your UPI ID in Settings first" }); return; }
  const [open] = await db.select({ id: payoutsTable.id }).from(payoutsTable).where(and(eq(payoutsTable.creatorId, creatorId), eq(payoutsTable.status, "requested")));
  if (open) { res.status(400).json({ error: "You already have a pending withdrawal" }); return; }
  const bal = await creatorBalance(creatorId);
  if (bal.available < config.minPayoutPaise) { res.status(400).json({ error: `Minimum withdrawal is ₹${config.minPayoutPaise / 100}` }); return; }
  const [p] = await db.insert(payoutsTable).values({ creatorId, amount: bal.available, upiId: creator.upiId }).returning();
  res.status(201).json(p);
});

export default router;
