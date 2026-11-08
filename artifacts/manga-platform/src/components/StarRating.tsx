import { useState } from "react";
import { Link } from "wouter";
import { Star } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export type RatingSummary = { average: number; count: number; mine: number | null };

/** Five stars. Read-only when `onRate` is missing. */
export function Stars({ value, size = "w-4 h-4", onRate, disabled }: { value: number; size?: string; onRate?: (n: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)} role={onRate ? "radiogroup" : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => {
        const fill = shown >= n ? 1 : shown >= n - 0.5 ? 0.5 : 0;
        const icon = (
          <span className="relative inline-block">
            <Star className={`${size} text-muted-foreground/40`} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: fill === 1 ? "100%" : "50%" }}>
                <Star className={`${size} text-yellow-400 fill-yellow-400`} />
              </span>
            )}
          </span>
        );
        return onRate ? (
          <button key={n} type="button" disabled={disabled} onMouseEnter={() => setHover(n)} onClick={() => onRate(n)}
            className="p-0.5 transition-transform hover:scale-110 disabled:opacity-60" aria-label={`${n} star${n > 1 ? "s" : ""}`} data-testid={`star-${n}`}>
            {icon}
          </button>
        ) : <span key={n}>{icon}</span>;
      })}
    </div>
  );
}

const LABELS = ["", "Didn't like it", "It was okay", "Good", "Really good", "Loved it!"];

/** Story rating: shows the average and lets a logged-in reader give 1–5 stars (and change it later). */
export function StoryRating({ mangaId, isOwner = false, compact = false, nextPath }: { mangaId: number; isOwner?: boolean; compact?: boolean; nextPath?: string }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const key = ["rating", mangaId, me?.id ?? null];
  const { data } = useQuery({ queryKey: key, queryFn: () => api<RatingSummary>(`/manga/${mangaId}/rating`), enabled: !!mangaId });
  const [err, setErr] = useState("");
  const rate = useMutation({
    mutationFn: (stars: number) => api<RatingSummary>(`/manga/${mangaId}/rating`, { method: "POST", body: { stars } }),
    onSuccess: d => { qc.setQueryData(key, d); setErr(""); },
    onError: (e: Error) => setErr(e.message),
  });

  const avg = data?.average ?? 0;
  const count = data?.count ?? 0;
  const mine = data?.mine ?? 0;

  return (
    <div className={compact ? "space-y-2" : "rounded-xl border border-border bg-card/40 p-4 space-y-3"} data-testid={`story-rating-${mangaId}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-2xl font-bold">{count ? avg.toFixed(1) : "—"}</span>
        <div>
          <Stars value={avg} />
          <p className="text-xs text-muted-foreground mt-0.5">{count ? `${count} rating${count > 1 ? "s" : ""}` : "No ratings yet"}</p>
        </div>
      </div>
      {isOwner ? (
        <p className="text-xs text-muted-foreground">Readers rate your story here.</p>
      ) : me ? (
        <div>
          <p className="text-xs text-muted-foreground mb-1">{mine ? "Your rating" : "Rate this story"}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Stars value={mine} size="w-6 h-6" onRate={n => rate.mutate(n)} disabled={rate.isPending} />
            {mine > 0 && <span className="text-xs text-yellow-400">{LABELS[mine]}</span>}
          </div>
          {err && <p className="text-xs text-red-400 mt-1">{err}{/profile/i.test(err) && <> — <Link href="/welcome" className="underline">finish setup</Link></>}</p>}
        </div>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(nextPath ?? window.location.pathname)}`} className="text-sm text-primary hover:underline">Log in to rate</Link>
      )}
    </div>
  );
}
