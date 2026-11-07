import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, X, BookOpen, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, rupees, type HistoryItem, type OrderView } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { resumeHref } from "@/components/ReaderRows";

function Purchases() {
  const { data } = useQuery({ queryKey: ["my-orders"], queryFn: () => api<OrderView[]>("/market/my-orders") });
  const [busy, setBusy] = useState<number | null>(null);
  const ebooks = data?.filter(o => o.format === "digital" && o.status === "paid") ?? [];
  if (!ebooks.length) return null;
  async function download(o: OrderView) {
    setBusy(o.id);
    try { const { url } = await api<{ url: string }>(`/market/orders/${o.id}/download-link`, { method: "POST" }); window.location.href = url; }
    finally { setTimeout(() => setBusy(null), 1500); }
  }
  return (
    <>
      <h2 className="text-2xl font-bold mb-5 brush-underline">Purchased eBooks</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 mb-14">
        {ebooks.map(o => (
          <div key={o.id}>
            <img src={o.coverImage} alt="" className="aspect-[3/4] w-full object-cover rounded-xl border border-border mb-2" />
            <p className="font-semibold text-sm line-clamp-2">{o.productTitle}</p>
            <p className="text-xs text-muted-foreground">{rupees(o.amount)}</p>
            <Button size="sm" className="w-full mt-2" disabled={busy === o.id} onClick={() => download(o)}>{busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1.5" /> Download</>}</Button>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Library() {
  const { me, loading } = useAuth();
  const qc = useQueryClient();
  const { data: history, isLoading } = useQuery({ queryKey: ["history", me?.id], queryFn: () => api<HistoryItem[]>("/me/history"), enabled: !!me });
  const { data: subs } = useQuery({ queryKey: ["my-subscriptions"], queryFn: () => api<{ id: number; name: string; avatar: string; totalManga: number }[]>("/me/subscriptions"), enabled: !!me });

  async function removeHistory(mangaId: number) {
    await api(`/me/history/${mangaId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["history"] }); qc.invalidateQueries({ queryKey: ["continue"] });
  }

  if (!loading && !me) return <div className="container px-4 py-20 text-center"><Link href="/login?next=/library" className="text-primary">Log in to see your Library</Link></div>;

  return (
    <div className="container px-4 py-10">
      <h1 className="text-4xl font-bold mb-2">My Library</h1>
      <p className="text-muted-foreground mb-10">What you've read and the creators you follow.</p>

      <h2 className="text-2xl font-bold mb-5 brush-underline">Reading history</h2>
      {isLoading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
      <div className="space-y-3 mb-14">
        {history?.map(h => (
          <div key={h.id} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card/40">
            <Link href={`/manga/${h.id}`}><img src={h.coverImage} alt="" className="w-14 h-20 object-cover rounded-md" /></Link>
            <div className="flex-1 min-w-0">
              <Link href={`/manga/${h.id}`} className="font-semibold hover:text-primary line-clamp-1">{h.title}</Link>
              <p className="text-xs text-muted-foreground">{h.creatorName} · Chapter {h.lastChapter}, page {h.lastPage + 1} · {new Date(h.lastReadAt).toLocaleDateString("en-IN")}</p>
              <div className="flex items-center gap-2 mt-2 max-w-sm">
                <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, h.progress)}%` }} /></div>
                <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(h.progress)}%</span>
              </div>
            </div>
            {h.isCompleted
              ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Finished</span>
              : <Button asChild size="sm"><Link href={resumeHref(h)}><BookOpen className="w-4 h-4 mr-1.5" /> Continue</Link></Button>}
            <Button size="icon" variant="ghost" onClick={() => removeHistory(h.id)} aria-label="Remove from history"><X className="w-4 h-4" /></Button>
          </div>
        ))}
        {history && history.length === 0 && <p className="text-muted-foreground">Nothing yet. <Link href="/browse" className="text-primary">Start reading</Link></p>}
      </div>

      <h2 className="text-2xl font-bold mb-5 brush-underline">Subscribed creators</h2>
      <div className="flex flex-wrap gap-4 mb-14">
        {subs?.map(c => (
          <Link key={c.id} href={`/creator/${c.id}`} className="flex items-center gap-3 p-3 pr-5 rounded-full border border-border bg-card/50 hover:border-primary/50 transition-colors">
            <img src={c.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
            <div><p className="text-sm font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.totalManga} series</p></div>
          </Link>
        ))}
        {subs && subs.length === 0 && <p className="text-muted-foreground">Tap <b>Subscribe</b> on a creator's page to get notified about new chapters.</p>}
      </div>

      {FEATURES.store && <Purchases />}
    </div>
  );
}
