import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";

/**
 * Readable URLs: series and creator pages use names ("/manga/supar-man-bana-lazy-man",
 * "/creator/ishwar-studio", "/u/ishwartudu9835") instead of database numbers.
 * Old number links still work and are swapped for the name once the page loads.
 */
type MangaLike = { id: number; slug?: string | null; mangaSlug?: string | null };
type CreatorLike = { id?: number; creatorId?: number; slug?: string | null; creatorSlug?: string | null };

export function mangaHref(m: MangaLike): string {
  const slug = m.slug ?? m.mangaSlug;
  return `/manga/${slug ? encodeURIComponent(slug) : m.id}`;
}

export function mangaKey(m: MangaLike): string {
  const slug = m.slug ?? m.mangaSlug;
  return slug ? encodeURIComponent(slug) : String(m.id);
}

/** For a series card: links to the series' creator. Pass the manga (uses creatorId/creatorSlug). */
export function creatorHrefFromManga(m: { creatorId: number; creatorSlug?: string | null }): string {
  return `/creator/${m.creatorSlug ? encodeURIComponent(m.creatorSlug) : m.creatorId}`;
}

export function creatorHref(c: CreatorLike): string {
  const slug = c.slug ?? c.creatorSlug;
  return `/creator/${slug ? encodeURIComponent(slug) : (c.id ?? c.creatorId)}`;
}

export function userHref(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

function decode(s: string | undefined): string {
  if (!s) return "";
  try { return decodeURIComponent(s); } catch { return s; }
}

/** Turn a URL key (number or name) into an id. */
export function useResolvedId(kind: "manga" | "creator", rawKey: string | undefined): { id: number; notFound: boolean; loading: boolean } {
  const key = decode(rawKey);
  const numeric = /^\d+$/.test(key);
  const q = useQuery({
    queryKey: [`${kind}-slug`, key],
    queryFn: () => api<{ id: number }>(`/${kind}-slug/${encodeURIComponent(key)}`),
    enabled: !!key && !numeric,
    staleTime: Infinity,
    retry: false,
  });
  if (numeric) return { id: parseInt(key, 10), notFound: false, loading: false };
  return { id: q.data?.id ?? 0, notFound: q.isError, loading: q.isLoading };
}

/** Once the page knows the real name, show it in the address bar (replacing a number). */
export function useCanonicalPath(rawKey: string | undefined, slug: string | null | undefined, build: (key: string) => string) {
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!slug || decode(rawKey) === slug) return;
    navigate(build(encodeURIComponent(slug)) + window.location.search, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawKey, slug]);
}

/** 0 → "0", 950 → "950", 1234 → "1.2K", 2500000 → "2.5M" */
export function formatCount(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
