import { setAuthTokenGetter } from "@workspace/api-client-react";
import { prepareImage, IMAGE_PRESETS } from "./image";

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
/** Referral code from a creator's link (?ref=...), remembered until signup. */
export function rememberRef() {
  try {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r && /^[a-z0-9]{3,40}$/i.test(r)) localStorage.setItem("surituk.ref", r);
  } catch { /* ignore */ }
}
export function getRef(): string | undefined {
  try { return localStorage.getItem("surituk.ref") ?? undefined; } catch { return undefined; }
}

export async function uploadFiles<T>(path: string, field: string, files: File[], onProgress?: (pct: number) => void): Promise<T> {
  const preset = IMAGE_PRESETS[path];
  if (preset) files = await Promise.all(files.map(f => prepareImage(f, preset)));
  return sendFiles<T>(path, field, files, onProgress);
}

function sendFiles<T>(path: string, field: string, files: File[], onProgress?: (pct: number) => void): Promise<T> {
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
    xhr.onerror = () => reject(new ApiError("Upload failed — check your internet connection and try again", 0));
    xhr.timeout = 180_000;
    xhr.ontimeout = () => reject(new ApiError("Upload took too long. Try a smaller file or a better connection.", 0));
    xhr.send(form);
  });
}

export const rupees = (paise: number | null | undefined) =>
  paise == null ? "—" : `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/* ---------- Shared types ---------- */

export type Me = {
  id: number; username: string; displayName: string; email: string | null; avatar: string; bio: string | null;
  role: "reader" | "creator" | "admin"; creatorId: number | null;
  isAdult: boolean; favoriteGenres: string[]; uiLanguage: "en" | "hi"; onboarded: boolean;
  creator: {
    id: number; name: string; type: "individual" | "studio"; status: "pending" | "approved" | "suspended" | "banned";
    studioName: string | null; bio: string | null; avatar: string; banner: string | null; city: string | null; state: string | null;
    isVerified: boolean; instagramUrl: string | null; twitterUrl: string | null; youtubeUrl: string | null; websiteUrl: string | null;
  } | null;
};

export type SeriesCard = {
  id: number; title: string; coverImage: string; genre: string; chapterCount: number; views: number; likes: number;
  status: string; isMature: boolean; creatorId: number; creatorName: string | null; creatorType?: string;
};

export type HistoryItem = SeriesCard & {
  lastChapter: number; lastChapterId: number | null; lastPage: number; progress: number; isCompleted: boolean; lastReadAt: string;
};

export const INDIAN_STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];

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
