import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, rupees, type OrderView } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** PhonePe redirects buyers here. We ask our server, which confirms with PhonePe. */
export default function PaymentStatus() {
  const ref = new URLSearchParams(window.location.search).get("order") ?? "";
  const { me, loading } = useAuth();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!ref || loading || !me) return;
    let tries = 0, stop = false;
    const check = async () => {
      try {
        const o = await api<OrderView>(`/market/orders/by-ref/${ref}`);
        if (stop) return;
        setOrder(o);
        if (o.status === "pending" && tries++ < 20) setTimeout(check, 3000);
      } catch (e) { setErr((e as Error).message); }
    };
    check();
    return () => { stop = true; };
  }, [ref, me, loading]);

  if (!loading && !me) return <div className="container px-4 py-20 text-center"><Link href={`/login?next=${encodeURIComponent(`/payment/status?order=${ref}`)}`} className="text-primary">Log in to see your order</Link></div>;

  return (
    <div className="container px-4 py-20 flex justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-8 text-center">
        {!order && !err && <><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" /><p className="mt-4 text-muted-foreground">Checking your payment…</p></>}
        {err && <><XCircle className="w-12 h-12 text-red-400 mx-auto" /><p className="mt-4">{err}</p></>}
        {order?.status === "pending" && <><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" /><h1 className="text-2xl font-bold mt-4">Payment processing</h1><p className="text-muted-foreground mt-2">This can take a minute. Don't close this page.</p></>}
        {order?.status === "failed" && <>
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold mt-4">Payment failed</h1>
          <p className="text-muted-foreground mt-2">No money was taken. If it was deducted, it will be refunded automatically by your bank.</p>
          <Button asChild className="mt-6"><Link href={`/store/${order.productId}`}>Try again</Link></Button>
        </>}
        {order?.status === "paid" && <>
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <h1 className="text-2xl font-bold mt-4">Payment successful</h1>
          <p className="text-muted-foreground mt-2">{order.productTitle} · {rupees(order.amount)}</p>
          <p className="text-sm mt-4">{order.format === "digital" ? "Your eBook is ready to download in your Library." : "The creator has your order and will ship it soon. You'll get a notification with tracking."}</p>
          <Button asChild className="mt-6"><Link href="/library">Go to my Library</Link></Button>
          <p className="text-xs text-muted-foreground mt-4">Order ID: {order.merchantOrderId}</p>
        </>}
      </div>
    </div>
  );
}
