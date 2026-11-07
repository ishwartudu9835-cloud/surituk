import { setAuthTokenGetter } from "@workspace/api-client-react";

/** Base URL of the API. Empty = same origin (local dev proxy / Replit). */
export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");

const TOKEN_KEY = "surituk.token";

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
}

// Make the generated React Query hooks send the login token too.
setAuthTokenGetter(() => getToken());

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}/api${path}`, {
    method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : null) ?? `Request failed (${res.status})`;
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

/** Upload with progress (fetch can't report upload progress). */
export function uploadFiles<T>(path: string, field: string, files: File[], onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach(f => form.append(field, f));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data: any = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new ApiError(data?.error ?? `Upload failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Network error during upload", 0));
    xhr.send(form);
  });
}

export const rupees = (paise: number | null | undefined) =>
  paise == null ? "—" : `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/* ---------- Shared types ---------- */

export type Me = {
  id: number; username: string; displayName: string; email: string | null; avatar: string;
  role: "reader" | "creator" | "admin"; creatorId: number | null;
  creator: { id: number; name: string; studioName: string | null; bio: string | null; avatar: string; banner: string | null; upiId: string | null; payoutName: string | null } | null;
};

export type Product = {
  id: number; creatorId: number; creatorName: string | null; creatorAvatar: string | null;
  title: string; description: string | null; coverImage: string; previewImages: string[];
  genre: string | null; language: string; pageCount: number | null;
  format: "digital" | "physical" | "both";
  digitalPrice: number | null; physicalPrice: number | null; shippingFee: number; stock: number | null;
  hasDigitalFile: boolean; digitalFileName: string | null; status: string; sales: number; createdAt: string;
  ownedDigital?: boolean; isMine?: boolean;
};

export type OrderView = {
  id: number; merchantOrderId: string; productId: number; productTitle: string; coverImage: string;
  format: "digital" | "physical"; quantity: number; amount: number;
  status: "pending" | "paid" | "failed"; fulfillment: string; trackingInfo: string | null;
  canDownload: boolean; createdAt: string; paidAt: string | null;
};
