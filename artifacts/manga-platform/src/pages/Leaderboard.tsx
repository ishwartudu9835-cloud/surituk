import { useState } from "react";
import { Link } from "wouter";
import {
  useGetMangaLeaderboard,
  useGetCreatorLeaderboard,
  getGetMangaLeaderboardQueryKey,
  getGetCreatorLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Medal, Eye, Users, ArrowUp } from "lucide-react";
import { motion } from "framer-motion";

type Period = "weekly" | "monthly";

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-400" />;
  if (trend === "new") return <ArrowUp className="w-3 h-3 text-yellow-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-300" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
}

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>("weekly");
  const [tab, setTab] = useState<"manga" | "creators">("manga");

  const { data: mangaLb, isLoading: mangaLoading } = useGetMangaLeaderboard(
    { period, limit: 20 },
    { query: { queryKey: getGetMangaLeaderboardQueryKey({ period, limit: 20 }) } }
  );
  const { data: creatorLb, isLoading: creatorLoading } = useGetCreatorLeaderboard(
    { period, limit: 10 },
    { query: { queryKey: getGetCreatorLeaderboardQueryKey({ period, limit: 10 }) } }
  );

  return (
    <div className="container px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">The top manga and creators on Surituk</p>
      </div>

      {/* Period toggle */}
      <div className="flex justify-center gap-2 mb-8">
        {(["weekly", "monthly"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all border ${period === p ? "bg-primary text-primary-foreground border-primary" : "border-white/10 text-muted-foreground hover:border-white/30"}`}
            data-testid={`button-period-${p}`}
          >
            {p === "weekly" ? "Weekly" : "Monthly"}
          </button>
        ))}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 mb-8 border-b border-white/10">
        {(["manga", "creators"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-all capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid={`tab-${t}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Manga leaderboard */}
      {tab === "manga" && (
        <div className="space-y-2">
          {/* Top 3 spotlight */}
          {!mangaLoading && mangaLb && mangaLb.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[mangaLb[1], mangaLb[0], mangaLb[2]].map((entry, i) => (
                <motion.div
                  key={entry.mangaId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative text-center p-4 rounded-xl border ${i === 1 ? "border-yellow-500/40 bg-yellow-500/5 -mt-4" : "border-white/10 bg-card/30"}`}
                  data-testid={`card-top-${entry.rank}`}
                >
                  <div className="flex justify-center mb-2"><RankBadge rank={entry.rank} /></div>
                  <Link href={`/manga/${entry.mangaId}`}>
                    <img src={entry.coverImage} alt={entry.title} className="w-20 h-28 object-cover rounded-lg mx-auto mb-2 border border-white/10" />
                    <p className="text-sm font-semibold line-clamp-2 hover:text-primary transition-colors">{entry.title}</p>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">{entry.creatorName}</p>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                    <Eye className="w-3 h-3" />{(entry.views / 1000).toFixed(0)}k
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {mangaLoading
            ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
            : mangaLb?.slice(3).map(entry => (
                <motion.div
                  key={entry.mangaId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-white/15 transition-all bg-card/20"
                  data-testid={`row-manga-${entry.rank}`}
                >
                  <div className="w-8 flex justify-center"><RankBadge rank={entry.rank} /></div>
                  <img src={entry.coverImage} alt={entry.title} className="w-10 h-14 object-cover rounded" />
                  <div className="flex-1">
                    <Link href={`/manga/${entry.mangaId}`} className="font-medium hover:text-primary transition-colors text-sm">{entry.title}</Link>
                    <p className="text-xs text-muted-foreground">{entry.creatorName}</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Eye className="w-3.5 h-3.5" />{entry.views.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <TrendIcon trend={entry.trend} />
                    {(entry.change ?? 0) > 0 && <span className="text-muted-foreground">{entry.change}</span>}
                  </div>
                </motion.div>
              ))}
        </div>
      )}

      {/* Creator leaderboard */}
      {tab === "creators" && (
        <div className="space-y-3">
          {creatorLoading
            ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            : creatorLb?.map(entry => (
                <motion.div
                  key={entry.creatorId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${entry.rank <= 3 ? "border-yellow-500/20 bg-yellow-500/5" : "border-white/5 hover:border-white/15 bg-card/20"}`}
                  data-testid={`row-creator-${entry.rank}`}
                >
                  <div className="w-8 flex justify-center"><RankBadge rank={entry.rank} /></div>
                  <img src={entry.avatar} alt={entry.name} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                  <div className="flex-1">
                    <Link href={`/creator/${entry.creatorId}`} className="font-medium hover:text-primary transition-colors">{entry.name}</Link>
                    {entry.studioName && <p className="text-xs text-muted-foreground">{entry.studioName}</p>}
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{(entry.totalViews / 1000).toFixed(0)}k</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{entry.followers.toLocaleString()}</span>
                  </div>
                  {entry.prize && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">{entry.prize}</Badge>
                  )}
                </motion.div>
              ))}
        </div>
      )}
    </div>
  );
}
