import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, rupees } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Overview = { orders: number; gross: number; commission: number; users: number; creators: number; books: number; pendingPayouts: number; pendingPayoutAmount: number };
type Payout = { id: number; creatorName: string; payoutName: string | null; amount: number; upiId: string; status: string; note: string | null; createdAt: string };
type Order = { id: number; merchantOrderId: string; productTitle: string; buyer: string | null; creator: string; format: string; amount: number; platformFee: number; status: string; fulfillment: string; createdAt: string };

export default function Admin() {
  const { me, loading } = useAuth();
  const qc = useQueryClient();
  const isAdmin = me?.role === "admin";
  const { data: o } = useQuery({ queryKey: ["admin-overview"], queryFn: () => api<Overview>("/admin/overview"), enabled: isAdmin });
  const { data: payouts } = useQuery({ queryKey: ["admin-payouts"], queryFn: () => api<Payout[]>("/admin/payouts"), enabled: isAdmin });
  const { data: orders } = useQuery({ queryKey: ["admin-orders"], queryFn: () => api<Order[]>("/admin/orders"), enabled: isAdmin });
  const [notes, setNotes] = useState<Record<number, string>>({});

  async function decide(id: number, status: "paid" | "rejected") {
    await api(`/admin/payouts/${id}`, { method: "PATCH", body: { status, note: notes[id] ?? "" } });
    qc.invalidateQueries({ queryKey: ["admin-payouts"] }); qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  if (loading) return null;
  if (!isAdmin) return <div className="container px-4 py-20 text-center text-muted-foreground">Admins only. <Link href="/" className="text-primary">Home</Link></div>;

  return (
    <div className="container px-4 py-10">
      <h1 className="text-4xl font-bold mb-8">Admin</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          ["Store sales", rupees(o?.gross)], ["Surituk commission", rupees(o?.commission)], ["Paid orders", o?.orders ?? "—"],
          ["Pending payouts", o ? `${o.pendingPayouts} · ${rupees(o.pendingPayoutAmount)}` : "—"],
          ["Users", o?.users ?? "—"], ["Creators", o?.creators ?? "—"], ["Books in Store", o?.books ?? "—"],
        ].map(([l, v]) => (
          <div key={String(l)} className="p-4 rounded-xl border border-border bg-card/40"><div className="text-2xl font-bold">{v}</div><div className="text-xs text-muted-foreground mt-1">{l}</div></div>
        ))}
      </div>

      <h2 className="text-2xl font-bold mb-2 brush-underline">Creator withdrawals</h2>
      <p className="text-sm text-muted-foreground mb-5 mt-4">Send the amount to the creator's UPI ID from your bank/UPI app, then click "Mark paid" with the UPI reference number.</p>
      <div className="space-y-3 mb-12">
        {payouts?.map(p => (
          <div key={p.id} className="p-4 rounded-xl border border-border bg-card/40 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 text-sm">
              <p className="font-semibold">{p.creatorName} — {rupees(p.amount)}</p>
              <p className="text-muted-foreground">UPI: <b className="text-foreground">{p.upiId}</b>{p.payoutName ? ` · ${p.payoutName}` : ""} · {new Date(p.createdAt).toLocaleDateString("en-IN")}</p>
              {p.note && <p className="text-xs text-muted-foreground">Note: {p.note}</p>}
            </div>
            {p.status === "requested" ? (
              <div className="flex gap-2 items-center">
                <Input placeholder="UPI ref / reason" className="w-44" value={notes[p.id] ?? ""} onChange={e => setNotes({ ...notes, [p.id]: e.target.value })} />
                <Button size="sm" onClick={() => decide(p.id, "paid")}>Mark paid</Button>
                <Button size="sm" variant="outline" onClick={() => decide(p.id, "rejected")}>Reject</Button>
              </div>
            ) : <span className={`text-xs px-2 py-1 rounded-full ${p.status === "paid" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>{p.status}</span>}
          </div>
        ))}
        {payouts?.length === 0 && <p className="text-muted-foreground">No withdrawal requests.</p>}
      </div>

      <h2 className="text-2xl font-bold mb-5 brush-underline">Recent orders</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground"><tr>
            <th className="p-3 text-left">Order</th><th className="p-3 text-left">Book</th><th className="p-3 text-left">Buyer</th><th className="p-3 text-left">Creator</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Commission</th><th className="p-3 text-left">Status</th>
          </tr></thead>
          <tbody>{orders?.map(r => (
            <tr key={r.id} className="border-t border-border">
              <td className="p-3 text-xs text-muted-foreground">{r.merchantOrderId}</td><td className="p-3">{r.productTitle} <span className="text-xs text-muted-foreground">({r.format === "physical" ? "print" : "eBook"})</span></td>
              <td className="p-3">{r.buyer}</td><td className="p-3">{r.creator}</td><td className="p-3 text-right">{rupees(r.amount)}</td><td className="p-3 text-right text-green-400">{rupees(r.platformFee)}</td>
              <td className="p-3">{r.status}{r.format === "physical" && r.status === "paid" ? ` · ${r.fulfillment}` : ""}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
