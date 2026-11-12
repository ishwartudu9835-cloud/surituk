import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, Package, Store as StoreIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, rupees, isCreator, type Product } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function priceLine(p: Product) {
  const parts: string[] = [];
  if (p.format !== "physical" && p.digitalPrice) parts.push(`${rupees(p.digitalPrice)} eBook`);
  if (p.format !== "digital" && p.physicalPrice) parts.push(`${rupees(p.physicalPrice)} Print`);
  return parts.join(" · ");
}

export default function Store() {
  const { me } = useAuth();
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<"" | "digital" | "physical">("");
  const [sort, setSort] = useState("new");

  const qs = new URLSearchParams({ ...(search ? { search } : {}), ...(format ? { format } : {}), sort }).toString();
  const { data, isLoading } = useQuery({ queryKey: ["market", qs], queryFn: () => api<Product[]>(`/market/products?${qs}`) });

  return (
    <div className="container px-4 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <p className="uppercase tracking-[0.3em] text-xs text-primary font-semibold mb-2">Surituk Store</p>
          <h1 className="text-4xl md:text-5xl font-bold">Buy books from creators</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">eBooks unlock instantly. Print copies ship straight from the creator. Most of every sale goes to the artist.</p>
        </div>
        {isCreator(me) && <Link href="/creator-dashboard?tab=store"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-lg border border-primary/40 bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors shrink-0">
          <StoreIcon className="w-4 h-4" /> Sell your book
        </Link>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search books or creators…" className="pl-9 h-11" />
        </div>
        <div className="flex gap-2">
          {([["", "All"], ["digital", "eBooks"], ["physical", "Print"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setFormat(v)} className={`h-11 px-4 rounded-lg text-sm border transition-colors ${format === v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-white/5"}`}>{label}</button>
          ))}
          <select value={sort} onChange={e => setSort(e.target.value)} className="h-11 rounded-lg bg-background border border-border px-3 text-sm">
            <option value="new">Newest</option>
            <option value="popular">Best selling</option>
            <option value="price">Lowest price</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
        {isLoading && Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
        {data?.map(p => (
          <Link key={p.id} href={`/store/${p.id}`} className="group">
            <div className="panel aspect-[3/4] mb-3">
              <img src={p.coverImage} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute top-2 left-2 flex gap-1">
                {p.format !== "physical" && <span className="px-2 py-0.5 rounded bg-black/70 text-[10px] font-semibold flex items-center gap-1"><BookOpen className="w-3 h-3" /> eBook</span>}
                {p.format !== "digital" && <span className="px-2 py-0.5 rounded bg-black/70 text-[10px] font-semibold flex items-center gap-1"><Package className="w-3 h-3" /> Print</span>}
              </div>
              {p.format !== "digital" && p.stock === 0 && <div className="absolute inset-x-0 bottom-0 bg-black/80 text-center text-xs py-1">Print sold out</div>}
            </div>
            <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{p.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{p.creatorName}</p>
            <p className="text-sm font-semibold text-accent mt-1">{priceLine(p)}</p>
          </Link>
        ))}
      </div>
      {data && data.length === 0 && <div className="text-center text-muted-foreground py-20 border border-dashed border-border rounded-2xl">No books found.</div>}
    </div>
  );
}
