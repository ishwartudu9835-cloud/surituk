import crypto from "node:crypto";
import { config } from "./config";

/** PhonePe PG Standard Checkout (v2) — https://developer.phonepe.com */
const hosts = {
  sandbox: { auth: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token", pg: "https://api-preprod.phonepe.com/apis/pg-sandbox" },
  production: { auth: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token", pg: "https://api.phonepe.com/apis/pg" },
};

let cached: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt - 60 > Date.now() / 1000) return cached.token;
  const h = hosts[config.phonepe.env];
  const res = await fetch(h.auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.phonepe.clientId,
      client_version: config.phonepe.clientVersion,
      client_secret: config.phonepe.clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`PhonePe auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { access_token: string; expires_at: number };
  cached = { token: data.access_token, expiresAt: data.expires_at };
  return data.access_token;
}

export async function createPayment(opts: { merchantOrderId: string; amountPaise: number; redirectUrl: string; udf1?: string }) {
  const token = await getToken();
  const res = await fetch(`${hosts[config.phonepe.env].pg}/checkout/v2/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${token}` },
    body: JSON.stringify({
      merchantOrderId: opts.merchantOrderId,
      amount: opts.amountPaise,
      expireAfter: 1200,
      metaInfo: opts.udf1 ? { udf1: opts.udf1 } : undefined,
      paymentFlow: { type: "PG_CHECKOUT", merchantUrls: { redirectUrl: opts.redirectUrl } },
    }),
  });
  if (!res.ok) throw new Error(`PhonePe create payment failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ orderId: string; state: string; redirectUrl: string }>;
}

export async function getOrderStatus(merchantOrderId: string) {
  const token = await getToken();
  const res = await fetch(`${hosts[config.phonepe.env].pg}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=false`, {
    headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`PhonePe status failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ orderId: string; state: "PENDING" | "COMPLETED" | "FAILED"; amount: number }>;
}

/** PhonePe sends Authorization = SHA256(username:password) configured in the dashboard. */
export function verifyWebhookAuth(header: string | undefined): boolean {
  if (!header || !config.phonepe.webhookUser) return false;
  const expected = crypto.createHash("sha256").update(`${config.phonepe.webhookUser}:${config.phonepe.webhookPass}`).digest("hex");
  const got = header.replace(/^SHA256\s*/i, "").trim().toLowerCase();
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
