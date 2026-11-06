import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Download, Package, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, rupees, type OrderView } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const FULFILL: Record<string, string> = { processing: "Preparing to ship", shipped: "Shipped", delivered: "Delivered", none: "" };

export default function Library() {
  const { me, loading } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: () => api<OrderView[]>("/market/my-orders"), enabled: !!me });
  const [busy, setBusy] = useState<number | null>(null);

  async function download(o: OrderView) {
    setBusy(o.id);
    try {
      const { url } = await api<{ url: string }>(`/market/orders/${o.id}/download-link`, { method: "POST" });
      window.location.href = url;
    } finally { setTimeout(() => setBusy(null), 1500); }
  }

  if (!loading && !me) return <div className="container px-4 py-20 text-center"><Link href="/login?next=/library" className="text-primary">Log in to see your Library</Link></div>;

  const ebooks = data?.filter(o => o.format === "digital" && o.status === "paid") ?? [];
  const prints = data?.filter(o => o.format === "physical" && o.status === "paid") ?? [];
  const pending = data?.filter(o => o.status === "pending") ?? [];

  return (
    <div className="container px-4 py-10">
      <h1 className="text-4xl font-bold mb-2">My Library</h1>
      <p className="text-muted-foreground mb-10">Books you've bought on Surituk.</p>
      {isLoading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}

      <h2 className="text-2xl font-bold mb-5 brush-underline">eBooks</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 mb-14">
        {ebooks.map(o => (
          <div key={o.id}>
            <Link href={`/store/${o.productId}`}><img src={o.coverImage} alt="" className="aspect-[3/4] w-full object-cover rounded-xl border border-border mb-3" /></Link>
            <p className="font-semibold text-sm line-clamp-2">{o.productTitle}</p>
            <Button size="sm" className="w-full mt-2" disabled={busy === o.id || !o.canDownload} onClick={() => download(o)}>
              {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1.5" /> Download</>}
            </Button>
          </div>
        ))}
        {data && ebooks.length === 0 && <p className="col-span-full text-muted-foreground">No eBooks yet. <Link href="/store" className="text-primary">Browse the Store</Link></p>}
      </div>

      <h2 className="text-2xl font-bold mb-5 brush-underline">Print orders</h2>
      <div className="space-y-3 mb-14">
        {prints.map(o => (
          <div key={o.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50">
            <img src={o.coverImage} alt="" className="w-12 h-16 object-cover rounded" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{o.productTitle} × {o.quantity}</p>
              <p className="text-xs text-muted-foreground">{o.merchantOrderId} · {rupees(o.amount)}</p>
              {o.trackingInfo && <p className="text-xs mt-1">Tracking: {o.trackingInfo}</p>}
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent flex items-center gap-1"><Package className="w-3 h-3" /> {FULFILL[o.fulfillment] || "Confirmed"}</span>
          </div>
        ))}
        {data && prints.length === 0 && <p className="text-muted-foreground">No print orders.</p>}
      </div>

      {pending.length > 0 && <>
        <h2 className="text-xl font-bold mb-4">Payments in progress</h2>
        <div className="space-y-2">{pending.map(o => (
          <Link key={o.id} href={`/payment/status?order=${o.merchantOrderId}`} className="flex items-center gap-3 p-3 rounded-lg border border-border text-sm hover:bg-white/5">
            <Clock className="w-4 h-4 text-muted-foreground" /> {o.productTitle} · {rupees(o.amount)} <span className="ml-auto text-muted-foreground">Check status →</span>
          </Link>
        ))}</div>
      </>}
    </div>
  );
}
