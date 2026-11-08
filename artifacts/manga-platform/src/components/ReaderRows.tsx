import { Link } from "wouter";
import { mangaHref } from "@/lib/links";
import { useQuery } from "@tanstack/react-query";
import { History, Sparkles } from "lucide-react";
import { api, type HistoryItem, type SeriesCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const resumeHref = (h: HistoryItem) =>
  h.lastChapterId ? `${mangaHref(h as never)}/chapter/${h.lastChapterId}${h.lastPage ? `?page=${h.lastPage}` : ""}` : mangaHref(h as never);

function ContinueCard({ h }: { h: HistoryItem }) {
  return (
    <Link href={resumeHref(h)} className="group shrink-0 w-36 sm:w-40">
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border mb-2 bg-card">
        <img src={h.coverImage} alt={h.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60"><div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(3, h.progress))}%` }} /></div>
      </div>
      <p className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">{h.title}</p>
      <p className="text-xs text-muted-foreground">Ch {h.lastChapter} · p{h.lastPage + 1} · {Math.round(h.progress)}%</p>
    </Link>
  );
}

export function SeriesTile({ m }: { m: SeriesCard }) {
  return (
    <Link href={mangaHref(m as never)} className="group shrink-0 w-36 sm:w-40">
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border mb-2 bg-card">
        <img src={m.coverImage} alt={m.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        {m.isMature && <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary">18+</span>}
      </div>
      <p className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">{m.title}</p>
      <p className="text-xs text-muted-foreground line-clamp-1">{m.genre} · {m.creatorName}</p>
    </Link>
  );
}

/** Continue Reading + For You — only for logged-in readers. */
export function ReaderRows() {
  const { me } = useAuth();
  const { data: cont } = useQuery({ queryKey: ["continue", me?.id], queryFn: () => api<HistoryItem[]>("/me/continue-reading"), enabled: !!me });
  const { data: forYou } = useQuery({ queryKey: ["for-you", me?.id], queryFn: () => api<{ basedOn: string[]; items: SeriesCard[] }>("/me/recommendations"), enabled: !!me });
  if (!me) return null;
  return (
    <>
      {cont && cont.length > 0 && (
        <section className="container px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2 brush-underline"><History className="text-primary w-6 h-6" /> Continue Reading</h2>
            <Link href="/library" className="text-sm text-muted-foreground hover:text-primary">History →</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">{cont.map(h => <ContinueCard key={h.id} h={h} />)}</div>
        </section>
      )}
      {forYou && forYou.items.length > 0 && (
        <section className="container px-4">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2 brush-underline"><Sparkles className="text-accent w-6 h-6" /> For You</h2>
            {forYou.basedOn.length > 0 && <p className="text-sm text-muted-foreground mt-3">Because you read {forYou.basedOn.slice(0, 3).join(", ")}</p>}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">{forYou.items.map(m => <SeriesTile key={m.id} m={m} />)}</div>
        </section>
      )}
    </>
  );
}
