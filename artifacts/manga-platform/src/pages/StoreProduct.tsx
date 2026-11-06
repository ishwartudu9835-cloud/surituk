import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Package, Truck, ShieldCheck, Loader2, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, rupees, type Product } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];
const ADDRESS_KEY = "surituk.address";

export default function StoreProduct() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const [, navigate] = useLocation();
  const { data: p, isLoading, error } = useQuery({ queryKey: ["product", id, me?.id], queryFn: () => api<Product>(`/market/products/${id}`) });

  const [shipOpen, setShipOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"" | "digital" | "physical">("");
  const [err, setErr] = useState("");
  const [addr, setAddr] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ADDRESS_KEY) ?? "") as Record<string, string>; }
    catch { return { name: "", phone: "", address: "", city: "", state: "", pincode: "" }; }
  });

  async function buy(format: "digital" | "physical") {
    if (!me) { navigate(`/login?next=/store/${id}`); return; }
    setBusy(format); setErr("");
    try {
      if (format === "physical") { try { localStorage.setItem(ADDRESS_KEY, JSON.stringify(addr)); } catch { /* ignore */ } }
      const r = await api<{ redirectUrl: string }>("/market/checkout", { body: { productId: Number(id), format, quantity: qty, shipping: format === "physical" ? addr : undefined } });
      window.location.href = r.redirectUrl;
    } catch (e) { setErr((e as Error).message); setBusy(""); }
  }

  if (isLoading) return <div className="container px-4 py-10 grid md:grid-cols-[320px_1fr] gap-10"><Skeleton className="aspect-[3/4] rounded-2xl" /><Skeleton className="h-64" /></div>;
  if (error || !p) return <div className="container px-4 py-20 text-center text-muted-foreground">Book not found. <Link href="/store" className="text-primary">Back to Store</Link></div>;

  const hasDigital = p.format !== "physical" && !!p.digitalPrice;
  const hasPrint = p.format !== "digital" && !!p.physicalPrice;
  const soldOut = p.stock === 0;
  const physicalTotal = (p.physicalPrice ?? 0) * qty + p.shippingFee;

  return (
    <div className="container px-4 py-10">
      <Link href="/store" className="text-sm text-muted-foreground hover:text-primary">← Store</Link>
      <div className="grid md:grid-cols-[320px_1fr] gap-10 mt-5">
        <div>
          <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-border shadow-2xl"><img src={p.coverImage} alt={p.title} className="w-full h-full object-cover" /></div>
          {p.previewImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-3">{p.previewImages.map(u => <img key={u} src={u} alt="" className="aspect-[3/4] object-cover rounded-md border border-border" />)}</div>
          )}
        </div>
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {p.genre && <span className="px-2.5 py-1 rounded-md bg-secondary text-xs">{p.genre}</span>}
            <span className="px-2.5 py-1 rounded-md bg-secondary text-xs">{p.language}</span>
            {p.pageCount && <span className="px-2.5 py-1 rounded-md bg-secondary text-xs">{p.pageCount} pages</span>}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">{p.title}</h1>
          <Link href={`/creator/${p.creatorId}`} className="inline-flex items-center gap-2 mt-3 text-primary hover:underline">
            {p.creatorAvatar && <img src={p.creatorAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />} by {p.creatorName}
          </Link>
          {p.description && <p className="text-muted-foreground mt-5 leading-relaxed whitespace-pre-line max-w-2xl">{p.description}</p>}

          <div className="grid sm:grid-cols-2 gap-4 mt-8 max-w-2xl">
            {hasDigital && (
              <div className="rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="w-4 h-4 text-primary" /> eBook (PDF/EPUB)</div>
                <div className="text-3xl font-bold mt-2">{rupees(p.digitalPrice)}</div>
                <p className="text-xs text-muted-foreground mt-1">Instant download after payment</p>
                {p.ownedDigital ? (
                  <Button asChild variant="outline" className="w-full mt-4"><Link href="/library"><Download className="w-4 h-4 mr-2" /> In your Library</Link></Button>
                ) : (
                  <Button onClick={() => buy("digital")} disabled={!!busy || p.isMine} className="w-full mt-4 font-semibold">
                    {busy === "digital" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buy eBook"}
                  </Button>
                )}
              </div>
            )}
            {hasPrint && (
              <div className="rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Package className="w-4 h-4 text-accent" /> Printed book</div>
                <div className="text-3xl font-bold mt-2">{rupees(p.physicalPrice)}</div>
                <p className="text-xs text-muted-foreground mt-1">{p.shippingFee ? `+ ${rupees(p.shippingFee)} shipping` : "Free shipping"}{p.stock !== null && p.stock > 0 && p.stock <= 10 ? ` · only ${p.stock} left` : ""}</p>
                <Button onClick={() => (me ? setShipOpen(true) : navigate(`/login?next=/store/${id}`))} disabled={soldOut || !!busy || p.isMine} variant="secondary" className="w-full mt-4 font-semibold">
                  {soldOut ? "Sold out" : "Buy print copy"}
                </Button>
              </div>
            )}
          </div>
          {p.isMine && <p className="text-sm text-muted-foreground mt-3">This is your book — manage it from Creator Studio.</p>}
          {err && !shipOpen && <p className="text-sm text-red-400 mt-3">{err}</p>}

          <div className="flex flex-wrap gap-5 text-xs text-muted-foreground mt-8">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Secure payment via PhonePe (UPI, cards, netbanking)</span>
            <span className="flex items-center gap-1.5"><Truck className="w-4 h-4" /> Print copies ship from the creator</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> {p.sales} sold</span>
          </div>
        </div>
      </div>

      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delivery address</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); buy("physical"); }}>
            <Input required placeholder="Full name" value={addr.name} onChange={e => setAddr({ ...addr, name: e.target.value })} />
            <Input required placeholder="10-digit mobile number" inputMode="numeric" value={addr.phone} onChange={e => setAddr({ ...addr, phone: e.target.value })} />
            <Input required placeholder="House no, street, area" value={addr.address} onChange={e => setAddr({ ...addr, address: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input required placeholder="City" value={addr.city} onChange={e => setAddr({ ...addr, city: e.target.value })} />
              <Input required placeholder="PIN code" inputMode="numeric" maxLength={6} value={addr.pincode} onChange={e => setAddr({ ...addr, pincode: e.target.value })} />
            </div>
            <select required value={addr.state} onChange={e => setAddr({ ...addr, state: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
              <option value="">State</option>{STATES.map(s => <option key={s}>{s}</option>)}
            </select>
            <div className="flex items-center justify-between text-sm pt-2">
              <span>Quantity</span>
              <select value={qty} onChange={e => setQty(Number(e.target.value))} className="h-9 rounded-md bg-background border border-input px-2">
                {Array.from({ length: Math.min(p.stock ?? 10, 10) }, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="rounded-lg bg-secondary/60 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Book × {qty}</span><span>{rupees((p.physicalPrice ?? 0) * qty)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{p.shippingFee ? rupees(p.shippingFee) : "Free"}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Total</span><span>{rupees(physicalTotal)}</span></div>
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            <Button type="submit" disabled={!!busy} className="w-full h-11 font-semibold">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pay ${rupees(physicalTotal)}`}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
