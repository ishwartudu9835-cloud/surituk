import { useState } from "react";
import { mangaHref, creatorHref } from "@/lib/links";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Eye, Users, Sparkles, CalendarDays, Calendar, Building2, CheckCircle, BadgeCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type Tab = "studios" | "new" | "weekly" | "monthly";
type SeriesRow = { rank: number; kind: "series"; id: number; title: string; coverImage: string; genre: string; creatorId: number; creatorName: string; views: number; periodViews: number; chapterCount: number; isMature: boolean };
type StudioRow = { rank: number; kind: "studio"; id: number; name: string; avatar: string; city: string | null; state: string | null; followers: number; totalViews: number; totalManga: number; periodViews: number; isVerified: boolean; isRegisteredStudio: boolean };

const TABS: { id: Tab; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "studios", label: "Top Studios", icon: <Building2 className="w-4 h-4" />, hint: "Studios with the most reads in the last 30 days" },
  { id: "new", label: "Top New", icon: <Sparkles className="w-4 h-4" />, hint: "Best series that started in the last 60 days" },
  { id: "weekly", label: "Weekly Top", icon: <CalendarDays className="w-4 h-4" />, hint: "Most-read series in the last 7 days" },
  { id: "monthly", label: "Monthly Top", icon: <Calendar className="w-4 h-4" />, hint: "Most-read series in the last 30 days" },
];

const medal = (r: number) => r === 1 ? "bg-yellow-500 text-black" : r === 2 ? "bg-zinc-300 text-black" : r === 3 ? "bg-amber-700 text-white" : "bg-secondary text-muted-foreground";
const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>("weekly");
  const { data, isLoading } = useQuery({ queryKey: ["leaderboard", tab], queryFn: () => api<(SeriesRow | StudioRow)[]>(`/leaderboards/${tab}`) });
  const current = TABS.find(t => t.id === tab)!;

  return (
    <div className="container px-4 py-10">
      <div className="flex items-center gap-3 mb-2"><Trophy className="w-8 h-8 text-accent" /><h1 className="text-4xl font-bold">Leaderboard</h1></div>
      <p className="text-muted-foreground mb-8">The most-read graphic novels and studios on Surituk.</p>

      <div className="flex gap-1 mb-2 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`pb-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t.icon}{t.label}</button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-6">{current.hint}</p>

      <div className="space-y-2">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        {data?.map(r => r.kind === "studio" ? (
          <Link key={`s${r.id}`} href={creatorHref(r as never)} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card/40 hover:border-primary/50 transition-colors">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${medal(r.rank)}`}>{r.rank}</span>
            <img src={r.avatar} alt="" className="w-14 h-14 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold flex items-center gap-1.5 truncate">{r.name}{r.isVerified && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}{r.isRegisteredStudio && <BadgeCheck className="w-4 h-4 text-accent shrink-0" />}</p>
              <p className="text-xs text-muted-foreground">{[r.city, r.state].filter(Boolean).join(", ") || "Studio"} · {r.totalManga} series</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold flex items-center gap-1 justify-end"><Eye className="w-4 h-4 text-muted-foreground" />{fmt(r.periodViews || r.totalViews)}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Users className="w-3 h-3" />{fmt(r.followers)}</p>
            </div>
          </Link>
        ) : (
          <Link key={`m${r.id}`} href={mangaHref(r as never)} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card/40 hover:border-primary/50 transition-colors">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${medal(r.rank)}`}>{r.rank}</span>
            <img src={r.coverImage} alt="" className="w-12 h-16 rounded-md object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{r.title} {r.isMature && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary ml-1">18+</span>}</p>
              <p className="text-xs text-muted-foreground truncate">{r.creatorName} · {r.genre} · {r.chapterCount} ch</p>
            </div>
            <p className="font-semibold text-sm flex items-center gap-1"><Eye className="w-4 h-4 text-muted-foreground" />{fmt(r.periodViews)}</p>
          </Link>
        ))}
        {data && data.length === 0 && <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">Nothing here yet. Rankings fill up as readers read.</div>}
      </div>
    </div>
  );
}
