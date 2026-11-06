import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

/** Only used in local development when PhonePe keys are not set. */
export default function MockPay() {
  const ref = new URLSearchParams(window.location.search).get("order") ?? "";
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(result: "success" | "fail") {
    setBusy(true);
    try {
      await api(`/market/orders/by-ref/${ref}/mock-pay`, { body: { result } });
      navigate(`/payment/status?order=${ref}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div className="container px-4 py-20 flex justify-center">
      <div className="w-full max-w-sm rounded-2xl border-2 border-dashed border-accent/50 p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-accent">Test payment</p>
        <h1 className="text-2xl font-bold mt-2">PhonePe is not connected yet</h1>
        <p className="text-sm text-muted-foreground mt-2">This fake page only appears in development. Order {ref}</p>
        <div className="flex gap-3 mt-6">
          <Button disabled={busy} onClick={() => go("success")} className="flex-1">Pay (success)</Button>
          <Button disabled={busy} onClick={() => go("fail")} variant="outline" className="flex-1">Fail</Button>
        </div>
        {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
      </div>
    </div>
  );
}
