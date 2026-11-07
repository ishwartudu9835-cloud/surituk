import { isImageFile } from "@/lib/image";
import { LANGUAGES, DEFAULT_LANGUAGE } from "@/lib/languages";
import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useGetCreator, useGetCreatorAnalytics, useCreateChapter, useListGenres,
  getGetCreatorQueryKey, getGetCreatorAnalyticsQueryKey, getListMangaQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  Eye, Heart, Users, BookOpen, Upload, BarChart2, Home, ChevronRight, CheckCircle, Store, Wallet, Settings,
  Loader2, ArrowUp, ArrowDown, X, FileUp, Package, Plus, IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { api, rupees, uploadFiles, type Product } from "@/lib/api";
import { pdfToImages } from "@/lib/pdf";
import { ManageSeries } from "@/components/ManageSeries";
import { FEATURES } from "@/lib/features";
import { Checkbox } from "@/components/ui/checkbox";
import { INDIAN_STATES } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Section = "overview" | "manga" | "upload-manga" | "upload-chapter" | "store" | "sales" | "team" | "settings";
type MySeries = { id: number; title: string; coverImage: string; chapterCount: number; views: number; isPublished: boolean; isMature: boolean; genre: string };
const sidebarItems: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BarChart2 className="w-4 h-4" /> },
  { id: "manga", label: "My Graphic Novels", icon: <BookOpen className="w-4 h-4" /> },
  { id: "upload-manga", label: "New Graphic Novel", icon: <Upload className="w-4 h-4" /> },
  { id: "upload-chapter", label: "Upload Chapter", icon: <Upload className="w-4 h-4" /> },
  ...(FEATURES.store ? [
    { id: "store" as Section, label: "Sell Books", icon: <Store className="w-4 h-4" /> },
    { id: "sales" as Section, label: "Sales & Payouts", icon: <Wallet className="w-4 h-4" /> },
  ] : []),
  { id: "team", label: "Studio Team", icon: <Users className="w-4 h-4" /> },
  { id: "settings", label: "Creator Page", icon: <Settings className="w-4 h-4" /> },
];

const RED = "hsl(358 80% 52%)";
const card = "p-6 rounded-xl border border-border bg-card/40";
const label = "text-sm font-medium mb-1.5 block";
const naturalSort = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

/* ---------------- Upload manga ---------------- */

function UploadManga({ onDone, canPublish }: { onDone: () => void; canPublish: boolean }) {
  const qc = useQueryClient();
  const { data: genres } = useListGenres();
  const [f, setF] = useState({ title: "", description: "", genre: "", language: DEFAULT_LANGUAGE, coverImage: "", bannerImage: "", tags: "", isMature: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (!f.coverImage) { setErr("Please upload a cover image"); return; }
    setBusy(true);
    try {
      await api("/manga", { body: {
        title: f.title, description: f.description, genre: f.genre || genres?.[0]?.name || "Action", language: f.language,
        coverImage: f.coverImage, bannerImage: f.bannerImage || undefined, isMature: f.isMature, publish: false,
        tags: f.tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 8),
      } });
      qc.invalidateQueries({ queryKey: ["my-series"] });
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">New Graphic Novel Series</h1>
      <form onSubmit={submit} className={`${card} grid md:grid-cols-[220px_1fr] gap-6`}>
        <div className="space-y-4">
          <div><label className={label}>Cover *</label><ImageUpload value={f.coverImage} onChange={coverImage => setF({ ...f, coverImage })} /></div>
          <div><label className={label}>Banner (wide)</label><ImageUpload value={f.bannerImage} onChange={bannerImage => setF({ ...f, bannerImage })} aspect="aspect-[16/7]" label="Upload banner" /></div>
        </div>
        <div className="space-y-4">
          <div><label className={label}>Title *</label><Input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
          <div><label className={label}>Description</label><Textarea rows={5} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="What is your graphic novel about?" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Genre *</label>
              <select required value={f.genre} onChange={e => setF({ ...f, genre: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
                <option value="">Choose…</option>{genres?.map(g => <option key={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div><label className={label}>Language</label>
              <select value={f.language} onChange={e => setF({ ...f, language: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">{LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
            </div>
          </div>
          <div><label className={label}>Tags</label><Input value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="comma separated, e.g. revenge, school" /></div>
          <label className="flex items-start gap-3 cursor-pointer text-sm">
            <Checkbox checked={f.isMature} onCheckedChange={v => setF({ ...f, isMature: v === true })} className="mt-0.5" />
            <span><b>18+ / mature content</b> <span className="text-muted-foreground">— only readers who confirmed 18+ will see it.</span></span>
          </label>
          <p className="text-xs text-muted-foreground rounded-lg bg-secondary/50 px-3 py-2">The series is saved as a <b>private draft</b>. Add chapters, then {canPublish ? "publish it from My Graphic Novels." : "publish after your creator account is approved."}</p>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create draft series"}</Button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Upload chapter (multi-image) ---------------- */

function UploadChapter({ myManga }: { myManga: { id: number; title: string; chapterCount: number }[] }) {
  const qc = useQueryClient();
  const createChapter = useCreateChapter();
  const input = useRef<HTMLInputElement>(null);
  const [mangaId, setMangaId] = useState("");
  const [num, setNum] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);

  const add = async (list: FileList | null) => {
    if (!list) return;
    const all = Array.from(list);
    const imgs = all.filter(isImageFile);
    const pdfs = all.filter(f => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    setMsg(null);
    if (imgs.length) setFiles(prev => [...prev, ...imgs].sort(naturalSort).slice(0, 200));
    // PDF pages keep their order from the PDF and are added after existing pages.
    for (const pdf of pdfs) {
      try {
        setConverting(`Reading ${pdf.name}…`);
        const pages = await pdfToImages(pdf, (d, t) => setConverting(`Converting ${pdf.name}: page ${d} of ${t}`));
        setFiles(prev => [...prev, ...pages].slice(0, 200));
      } catch (e) {
        setMsg({ ok: false, text: `Could not read ${pdf.name}. Is it a valid, non-password-protected PDF?` });
      }
    }
    setConverting(null);
  };
  const move = (i: number, d: -1 | 1) => setFiles(prev => {
    const next = [...prev]; const j = i + d; if (j < 0 || j >= next.length) return prev;
    [next[i], next[j]] = [next[j], next[i]]; return next;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!files.length) { setMsg({ ok: false, text: "Add the chapter pages (images)" }); return; }
    try {
      // Upload in batches of 20 so big chapters don't time out.
      const urls: string[] = [];
      for (let i = 0; i < files.length; i += 20) {
        const batch = files.slice(i, i + 20);
        const r = await uploadFiles<{ urls: string[] }>("/uploads/images", "files", batch, p => setPct(Math.round(((i + (p / 100) * batch.length) / files.length) * 100)));
        urls.push(...r.urls);
      }
      setPct(100);
      await createChapter.mutateAsync({ mangaId: Number(mangaId), data: { chapterNumber: Number(num), title, pages: urls } });
      qc.invalidateQueries();
      setMsg({ ok: true, text: `Chapter ${num} published with ${urls.length} pages!` });
      setFiles([]); setTitle(""); setNum(String(Number(num) + 1));
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.error ?? e?.message ?? "Upload failed" });
    } finally { setPct(null); }
  }

  if (!myManga.length) return <div className={card}>Create a graphic novel series first, then add chapters to it.</div>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Upload Chapter</h1>
      <form onSubmit={submit} className={`${card} space-y-5`}>
        <div className="grid sm:grid-cols-[1fr_120px_1fr] gap-3">
          <div><label className={label}>Series *</label>
            <select required value={mangaId} onChange={e => { setMangaId(e.target.value); const m = myManga.find(x => String(x.id) === e.target.value); if (m && !num) setNum(String(m.chapterCount + 1)); }} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
              <option value="">Select series</option>{myManga.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div><label className={label}>Chapter # *</label><Input required type="number" step="0.1" min="0" value={num} onChange={e => setNum(e.target.value)} /></div>
          <div><label className={label}>Chapter title *</label><Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. The Beginning" /></div>
        </div>

        <div
          onClick={() => input.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); add(e.dataTransfer.files); }}
          className="rounded-xl border-2 border-dashed border-border hover:border-primary/60 p-8 text-center cursor-pointer transition-colors"
        >
          <FileUp className="w-8 h-8 mx-auto text-primary mb-2" />
          <p className="font-medium">Drop chapter pages or a PDF here, or click to choose</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, or images (JPG / PNG / WEBP) · up to 200 pages · images are sorted by file name (01.jpg, 02.jpg…)</p>
          <input ref={input} type="file" multiple accept="image/*,application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={e => { add(e.target.files); e.target.value = ""; }} />
        </div>

        {converting && <p className="text-sm text-accent flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {converting}</p>}

        {files.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2 text-sm"><span>{files.length} pages</span><button type="button" onClick={() => setFiles([])} className="text-muted-foreground hover:text-red-400">Clear all</button></div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-96 overflow-y-auto pr-1">
              {files.map((f, i) => (
                <div key={f.name + i} className="relative group">
                  <img src={previews[i]} alt="" className="aspect-[3/4] w-full object-cover rounded-md border border-border" />
                  <span className="absolute top-1 left-1 text-[10px] bg-black/70 rounded px-1">{i + 1}</span>
                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 p-1 opacity-0 group-hover:opacity-100 bg-black/60">
                    <button type="button" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><X className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pct !== null && <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>}
        {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>}
        <Button type="submit" disabled={pct !== null || !!converting} className="w-full">{pct !== null ? `Uploading… ${pct}%` : converting ? "Converting PDF…" : "Publish chapter"}</Button>
      </form>
    </div>
  );
}

/* ---------------- Sell books ---------------- */

type ProductForm = {
  id?: number; title: string; description: string; genre: string; language: string; pageCount: string;
  format: "digital" | "physical" | "both"; digitalPrice: string; physicalPrice: string; shippingFee: string; stock: string;
  coverImage: string; digitalFileKey: string; digitalFileName: string; status: string;
};
const emptyProduct: ProductForm = { title: "", description: "", genre: "", language: DEFAULT_LANGUAGE, pageCount: "", format: "digital", digitalPrice: "", physicalPrice: "", shippingFee: "0", stock: "", coverImage: "", digitalFileKey: "", digitalFileName: "", status: "active" };
const toForm = (p: Product): ProductForm => ({
  id: p.id, title: p.title, description: p.description ?? "", genre: p.genre ?? "", language: p.language, pageCount: p.pageCount ? String(p.pageCount) : "",
  format: p.format, digitalPrice: p.digitalPrice ? String(p.digitalPrice / 100) : "", physicalPrice: p.physicalPrice ? String(p.physicalPrice / 100) : "",
  shippingFee: String(p.shippingFee / 100), stock: p.stock === null ? "" : String(p.stock), coverImage: p.coverImage,
  digitalFileKey: "", digitalFileName: p.digitalFileName ?? "", status: p.status,
});

function ProductEditor({ initial, hasExistingFile, onClose }: { initial: ProductForm; hasExistingFile: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: genres } = useListGenres();
  const [f, setF] = useState(initial);
  const [pct, setPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (k: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const digital = f.format !== "physical", print = f.format !== "digital";
  const earn = (rs: string) => Number(rs) > 0 ? rupees(Math.round(Number(rs) * 100 * 0.8)) : "—";

  async function uploadBook(file?: File) {
    if (!file) return;
    setErr(""); setPct(0);
    try {
      const r = await uploadFiles<{ key: string; fileName: string }>("/uploads/book", "file", [file], setPct);
      setF(prev => ({ ...prev, digitalFileKey: r.key, digitalFileName: r.fileName }));
    } catch (e) { setErr((e as Error).message); } finally { setPct(null); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const body: Record<string, unknown> = {
      title: f.title, description: f.description, genre: f.genre, language: f.language, pageCount: f.pageCount,
      format: f.format, coverImage: f.coverImage, status: f.status,
      ...(digital ? { digitalPrice: f.digitalPrice } : {}),
      ...(print ? { physicalPrice: f.physicalPrice, shippingFee: f.shippingFee || 0, stock: f.stock } : {}),
      ...(f.digitalFileKey ? { digitalFileKey: f.digitalFileKey, digitalFileName: f.digitalFileName } : {}),
    };
    try {
      await api(f.id ? `/market/products/${f.id}` : "/market/products", { method: f.id ? "PATCH" : "POST", body });
      qc.invalidateQueries({ queryKey: ["my-products"] });
      qc.invalidateQueries({ queryKey: ["market"] });
      onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <form onSubmit={save} className={`${card} grid md:grid-cols-[220px_1fr] gap-6`}>
      <div><label className={label}>Cover *</label><ImageUpload value={f.coverImage} onChange={coverImage => setF({ ...f, coverImage })} /></div>
      <div className="space-y-4">
        <div><label className={label}>Book title *</label><Input required value={f.title} onChange={set("title")} placeholder="e.g. My Graphic Novel — Volume 1" /></div>
        <div><label className={label}>Description</label><Textarea rows={4} value={f.description} onChange={set("description")} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={label}>Genre</label><select value={f.genre} onChange={set("genre")} className="w-full h-10 rounded-md bg-background border border-input px-2 text-sm"><option value="">—</option>{genres?.map(g => <option key={g.id}>{g.name}</option>)}</select></div>
          <div><label className={label}>Language</label><select value={f.language} onChange={set("language")} className="w-full h-10 rounded-md bg-background border border-input px-2 text-sm">{LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
          <div><label className={label}>Pages</label><Input type="number" min="1" value={f.pageCount} onChange={set("pageCount")} /></div>
        </div>

        <div>
          <label className={label}>What are you selling? *</label>
          <div className="grid grid-cols-3 gap-2">
            {([["digital", "eBook only"], ["physical", "Print only"], ["both", "Both"]] as const).map(([v, l]) => (
              <button type="button" key={v} onClick={() => setF({ ...f, format: v })} className={`h-10 rounded-lg border text-sm ${f.format === v ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-white/5"}`}>{l}</button>
            ))}
          </div>
        </div>

        {digital && (
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> eBook</p>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div><label className={label}>Price (₹) *</label><Input required type="number" min="10" step="1" value={f.digitalPrice} onChange={set("digitalPrice")} /></div>
              <p className="text-xs text-muted-foreground pb-2">You earn {earn(f.digitalPrice)} per sale</p>
            </div>
            <div>
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={pct !== null}>
                {pct !== null ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {pct}%</> : <><FileUp className="w-4 h-4 mr-2" /> {f.digitalFileKey || hasExistingFile ? "Replace book file" : "Upload book file *"}</>}
              </Button>
              <input ref={fileInput} type="file" accept=".pdf,.epub,.cbz,application/pdf,application/epub+zip" className="sr-only" tabIndex={-1} onChange={e => { uploadBook(e.target.files?.[0]); e.target.value = ""; }} />
              <p className="text-xs text-muted-foreground mt-2">{f.digitalFileKey ? `✓ ${f.digitalFileName} uploaded` : hasExistingFile ? `Current file: ${f.digitalFileName}` : "PDF, EPUB or CBZ · max 150 MB · only buyers can download it"}</p>
            </div>
          </div>
        )}

        {print && (
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-accent" /> Printed book <span className="text-xs font-normal text-muted-foreground">(you ship it yourself)</span></p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={label}>Price (₹) *</label><Input required type="number" min="10" value={f.physicalPrice} onChange={set("physicalPrice")} /></div>
              <div><label className={label}>Shipping (₹)</label><Input type="number" min="0" value={f.shippingFee} onChange={set("shippingFee")} /></div>
              <div><label className={label}>Stock</label><Input type="number" min="0" value={f.stock} onChange={set("stock")} placeholder="∞" /></div>
            </div>
            <p className="text-xs text-muted-foreground">You earn {earn(f.physicalPrice)} per copy + the full shipping fee.</p>
          </div>
        )}

        {f.id && (
          <div><label className={label}>Visibility</label>
            <select value={f.status} onChange={set("status")} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
              <option value="active">Live in Store</option><option value="draft">Hidden (draft)</option><option value="removed">Delete from Store</option>
            </select>
          </div>
        )}
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || pct !== null} className="flex-1">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : f.id ? "Save changes" : "Publish to Store"}</Button>
        </div>
      </div>
    </form>
  );
}

function SellBooks() {
  const { data, isLoading } = useQuery({ queryKey: ["my-products"], queryFn: () => api<Product[]>("/market/my-products") });
  const [editing, setEditing] = useState<{ form: ProductForm; hasFile: boolean } | null>(null);

  if (editing) return <div className="max-w-4xl"><h1 className="text-3xl font-bold mb-6">{editing.form.id ? "Edit book" : "Sell a new book"}</h1><ProductEditor initial={editing.form} hasExistingFile={editing.hasFile} onClose={() => setEditing(null)} /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold">Sell Books</h1><p className="text-sm text-muted-foreground mt-1">Sell eBooks and printed volumes. Surituk keeps 20% of the book price; you get the rest.</p></div>
        <Button onClick={() => setEditing({ form: emptyProduct, hasFile: false })}><Plus className="w-4 h-4 mr-1.5" /> Add book</Button>
      </div>
      {isLoading && <Skeleton className="h-40" />}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {data?.map(p => (
          <button key={p.id} onClick={() => setEditing({ form: toForm(p), hasFile: p.hasDigitalFile })} className="text-left group">
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border mb-2">
              <img src={p.coverImage} alt="" className="w-full h-full object-cover" />
              {p.status === "draft" && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded bg-black/80">Hidden</span>}
            </div>
            <p className="font-semibold text-sm group-hover:text-primary line-clamp-2">{p.title}</p>
            <p className="text-xs text-muted-foreground">{p.sales} sold{p.stock !== null && p.format !== "digital" ? ` · ${p.stock} in stock` : ""}</p>
          </button>
        ))}
      </div>
      {data && data.length === 0 && <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground">No books yet. Click "Add book" to start selling.</div>}
    </div>
  );
}

/* ---------------- Sales & payouts ---------------- */

type Summary = { totalSales: number; grossSales: number; totalEarnings: number; clearedEarnings: number; withdrawn: number; available: number; commissionPercent: number; minPayout: number };
type CreatorOrder = { id: number; merchantOrderId: string; productTitle: string; buyerName: string; format: string; quantity: number; amount: number; platformFee: number; creatorEarning: number; fulfillment: string; trackingInfo: string | null; shipping: Record<string, string> | null; paidAt: string };
type PayoutRow = { id: number; amount: number; upiId: string; status: string; note: string | null; createdAt: string };

function Sales({ goSettings }: { goSettings: () => void }) {
  const qc = useQueryClient();
  const { me } = useAuth();
  const { data: s } = useQuery({ queryKey: ["creator-summary"], queryFn: () => api<Summary>("/market/creator/summary") });
  const { data: orders } = useQuery({ queryKey: ["creator-orders"], queryFn: () => api<CreatorOrder[]>("/market/creator/orders") });
  const { data: payouts } = useQuery({ queryKey: ["creator-payouts"], queryFn: () => api<PayoutRow[]>("/market/creator/payouts") });
  const [ship, setShip] = useState<CreatorOrder | null>(null);
  const [tracking, setTracking] = useState("");
  const [msg, setMsg] = useState("");

  async function updateOrder(o: CreatorOrder, fulfillment: string) {
    await api(`/market/creator/orders/${o.id}`, { method: "PATCH", body: { fulfillment, trackingInfo: tracking } });
    setShip(null); setTracking("");
    qc.invalidateQueries({ queryKey: ["creator-orders"] }); qc.invalidateQueries({ queryKey: ["creator-summary"] });
  }
  async function withdraw() {
    setMsg("");
    try { await api("/market/creator/payouts", { method: "POST" }); setMsg("Withdrawal requested. It will be sent to your UPI within 3–5 working days."); qc.invalidateQueries(); }
    catch (e) { setMsg((e as Error).message); }
  }

  const toShip = orders?.filter(o => o.format === "physical" && o.fulfillment === "processing") ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Sales & Payouts</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { l: "Books sold", v: s?.totalSales ?? "—" },
          { l: "Total sales", v: rupees(s?.grossSales) },
          { l: "Your earnings", v: rupees(s?.totalEarnings) },
          { l: "Available to withdraw", v: rupees(s?.available), hi: true },
        ].map(c => (
          <div key={c.l} className={`p-4 rounded-xl border ${c.hi ? "border-primary/40 bg-primary/10" : "border-border bg-card/40"}`}>
            <div className="text-2xl font-bold">{c.v}</div><div className="text-xs text-muted-foreground mt-1">{c.l}</div>
          </div>
        ))}
      </div>

      <div className={`${card} mb-8 flex flex-col md:flex-row md:items-center gap-4`}>
        <div className="flex-1 text-sm">
          <p className="font-semibold mb-1 flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Withdraw to UPI</p>
          <p className="text-muted-foreground">eBook earnings are available right away; print earnings once you mark the order shipped. Minimum withdrawal {rupees(s?.minPayout)}.</p>
          <p className="mt-1">UPI: {(me?.creator as { upiId?: string } | null)?.upiId ? <b>{(me?.creator as { upiId?: string } | null)?.upiId}</b> : <button onClick={goSettings} className="text-primary underline">add your UPI ID</button>}</p>
          {msg && <p className="mt-2 text-accent">{msg}</p>}
        </div>
        <Button onClick={withdraw} disabled={!s || s.available < s.minPayout || !(me?.creator as { upiId?: string } | null)?.upiId}>Withdraw {rupees(s?.available)}</Button>
      </div>

      {toShip.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-3 text-accent">To ship ({toShip.length})</h2>
          <div className="space-y-3">{toShip.map(o => (
            <div key={o.id} className="p-4 rounded-xl border border-accent/40 bg-accent/5 flex flex-col md:flex-row gap-4 md:items-center">
              <div className="flex-1 text-sm">
                <p className="font-semibold">{o.productTitle} × {o.quantity}</p>
                <p className="text-muted-foreground">{o.shipping?.name} · {o.shipping?.phone}</p>
                <p className="text-muted-foreground">{o.shipping?.address}, {o.shipping?.city}, {o.shipping?.state} – {o.shipping?.pincode}</p>
              </div>
              <Button onClick={() => { setShip(o); setTracking(""); }}>Mark shipped</Button>
            </div>
          ))}</div>
        </div>
      )}

      <h2 className="text-xl font-bold mb-3">All sales</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase"><tr>
            <th className="text-left p-3">Book</th><th className="text-left p-3">Type</th><th className="text-right p-3">Paid</th><th className="text-right p-3">Surituk fee</th><th className="text-right p-3">You get</th><th className="text-left p-3">Status</th><th className="text-left p-3">Date</th>
          </tr></thead>
          <tbody>
            {orders?.map(o => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3">{o.productTitle}{o.quantity > 1 ? ` × ${o.quantity}` : ""}</td>
                <td className="p-3 capitalize">{o.format === "physical" ? "Print" : "eBook"}</td>
                <td className="p-3 text-right">{rupees(o.amount)}</td>
                <td className="p-3 text-right text-muted-foreground">−{rupees(o.platformFee)}</td>
                <td className="p-3 text-right font-semibold text-green-400">{rupees(o.creatorEarning)}</td>
                <td className="p-3 capitalize">{o.format === "physical" ? (o.fulfillment === "processing"
                  ? <button className="text-accent underline" onClick={() => setShip(o)}>to ship</button>
                  : <select value={o.fulfillment} onChange={e => updateOrder(o, e.target.value)} className="bg-transparent text-sm"><option value="shipped">shipped</option><option value="delivered">delivered</option></select>) : "delivered"}</td>
                <td className="p-3 text-muted-foreground">{new Date(o.paidAt).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
            {orders && orders.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No sales yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {payouts && payouts.length > 0 && <>
        <h2 className="text-xl font-bold mt-8 mb-3">Withdrawals</h2>
        <div className="space-y-2">{payouts.map(p => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border text-sm">
            <span className="font-semibold">{rupees(p.amount)}</span><span className="text-muted-foreground">→ {p.upiId}</span>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${p.status === "paid" ? "bg-green-500/15 text-green-400" : p.status === "rejected" ? "bg-red-500/15 text-red-400" : "bg-accent/15 text-accent"}`}>{p.status}</span>
            <span className="text-muted-foreground text-xs">{new Date(p.createdAt).toLocaleDateString("en-IN")}</span>
          </div>
        ))}</div>
      </>}

      <Dialog open={!!ship} onOpenChange={o => !o && setShip(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark as shipped</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Add the courier name and tracking number so the buyer can track it.</p>
          <Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="e.g. India Post EE123456789IN" />
          <Button onClick={() => ship && updateOrder(ship, "shipped")}>Confirm shipped</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Settings ---------------- */

function CreatorSettings() {
  const { me, refresh } = useAuth();
  const qc = useQueryClient();
  const c = me?.creator;
  const studio = c?.type === "studio";
  const [f, setF] = useState({
    name: c?.name ?? "", studioName: c?.studioName ?? "", bio: c?.bio ?? "", city: c?.city ?? "", state: c?.state ?? "",
    avatar: c?.avatar?.startsWith("http") ? c.avatar : "", banner: c?.banner ?? "",
    instagramUrl: c?.instagramUrl ?? "", twitterUrl: c?.twitterUrl ?? "", youtubeUrl: c?.youtubeUrl ?? "", websiteUrl: c?.websiteUrl ?? "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    try {
      await api("/creators/me", { body: f });
      await refresh();
      if (c) qc.invalidateQueries({ queryKey: getGetCreatorQueryKey(c.id) });
      setMsg({ ok: true, t: "Saved" });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">{studio ? "Studio Page" : "Creator Page"}</h1>
      <form onSubmit={save} className={`${card} space-y-5`}>
        <div className="grid sm:grid-cols-[160px_1fr] gap-5">
          <div><label className={label}>{studio ? "Studio logo" : "Profile photo"}</label><ImageUpload value={f.avatar} onChange={avatar => setF({ ...f, avatar })} aspect="aspect-square" label="Upload" /></div>
          <div><label className={label}>Banner</label><ImageUpload value={f.banner} onChange={banner => setF({ ...f, banner })} aspect="aspect-[16/6]" label="Upload banner" /></div>
        </div>
        <div><label className={label}>{studio ? "Studio name" : "Creator name"}</label><Input value={f.name} onChange={set("name")} /></div>
        <div><label className={label}>{studio ? "Studio description" : "Bio"}</label><Textarea rows={4} value={f.bio} onChange={set("bio")} placeholder="Tell readers about your stories" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>City</label><Input value={f.city} onChange={set("city")} /></div>
          <div><label className={label}>State</label><select value={f.state} onChange={set("state")} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm"><option value="">—</option>{INDIAN_STATES.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
          <div><label className={label}>Instagram</label><Input value={f.instagramUrl} onChange={set("instagramUrl")} placeholder="https://instagram.com/…" /></div>
          <div><label className={label}>X (Twitter)</label><Input value={f.twitterUrl} onChange={set("twitterUrl")} placeholder="https://x.com/…" /></div>
          <div><label className={label}>YouTube</label><Input value={f.youtubeUrl} onChange={set("youtubeUrl")} placeholder="https://youtube.com/@…" /></div>
          <div><label className={label}>Website</label><Input value={f.websiteUrl} onChange={set("websiteUrl")} placeholder="https://" /></div>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.t}</p>}
        <div className="flex gap-3">
          <Button type="submit" className="flex-1">Save</Button>
          {c && c.status === "approved" && <Button asChild variant="outline"><Link href={`/creator/${c.id}`}>View public page</Link></Button>}
        </div>
      </form>
      <p className="text-xs text-muted-foreground mt-4">Payment details (UPI) are asked only when your earnings reach the minimum payout.</p>
    </div>
  );
}

/* ---------------- Studio team ---------------- */

function StudioTeam() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["studio-team"], queryFn: () => api<{ id: number; name: string; email: string; role: string; status: string }[]>("/pro/team") });
  const [f, setF] = useState({ name: "", email: "", role: "artist" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  if (me?.creator?.type !== "studio") return <div className={card}>Team members are for Studio accounts.</div>;
  async function invite(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    try { await api("/pro/team", { body: f }); setF({ name: "", email: "", role: "artist" }); setMsg({ ok: true, t: "Invite sent by email" }); qc.invalidateQueries({ queryKey: ["studio-team"] }); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  }
  async function remove(id: number) {
    if (!confirm("Remove this member from the studio?")) return;
    await api(`/pro/team/${id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["studio-team"] });
  }
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Studio Team</h1>
      <div className={card}>
        <div className="divide-y divide-border">
          {data?.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0"><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground truncate">{m.email}</p></div>
              <span className="text-xs capitalize px-2 py-0.5 rounded bg-secondary">{m.role}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${m.status === "active" ? "bg-green-500/15 text-green-400" : "bg-accent/15 text-accent"}`}>{m.status === "active" ? "Joined" : "Invited"}</span>
              {m.role !== "owner" && <Button size="icon" variant="ghost" onClick={() => remove(m.id)} aria-label="Remove"><X className="w-4 h-4" /></Button>}
            </div>
          ))}
        </div>
      </div>
      <form onSubmit={invite} className={`${card} space-y-3`}>
        <h2 className="font-bold">Invite a member</h2>
        <div className="grid sm:grid-cols-[1fr_1fr_130px] gap-2">
          <Input required placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <Input required type="email" placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          <select value={f.role} onChange={e => setF({ ...f, role: e.target.value })} className="h-10 rounded-md bg-background border border-input px-3 text-sm"><option value="artist">Artist</option><option value="writer">Writer</option><option value="editor">Editor</option></select>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.t}</p>}
        <Button type="submit">Send invite</Button>
      </form>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function CreatorDashboard() {
  const { me, loading } = useAuth();
  const initialTab = (new URLSearchParams(window.location.search).get("tab") as Section | null) ?? "overview";
  const [active, setActiveRaw] = useState<Section>(sidebarItems.some(i => i.id === initialTab) ? initialTab : "overview");
  const [managing, setManaging] = useState<number | null>(null);
  const setActive = (s: Section) => { setManaging(null); setActiveRaw(s); };

  const creatorId = me?.creatorId ?? 0;
  const enabled = creatorId > 0;
  const { data: creator } = useGetCreator(creatorId, { query: { queryKey: getGetCreatorQueryKey(creatorId), enabled } });
  const { data: analytics } = useGetCreatorAnalytics(creatorId, { query: { queryKey: getGetCreatorAnalyticsQueryKey(creatorId), enabled } });
  const { data: myManga = [] } = useQuery({ queryKey: ["my-series"], queryFn: () => api<MySeries[]>("/studio/my-series"), enabled });
  const status = me?.creator?.status;
  const approved = status === "approved";

  if (loading) return <div className="container px-4 py-10"><Skeleton className="h-10 w-64 mb-6" /><Skeleton className="h-64" /></div>;
  if (!me) return (
    <div className="container px-4 py-20 text-center max-w-md">
      <h1 className="text-3xl font-bold mb-3">Creator Studio</h1>
      <p className="text-muted-foreground mb-6">Log in to publish your graphic novels.</p>
      <Button asChild><Link href="/login?next=/creator-dashboard">Log in / Sign up</Link></Button>
    </div>
  );
  if (!me.creatorId) return (
    <div className="container px-4 py-20 text-center max-w-lg">
      <h1 className="text-3xl font-bold mb-3">Creator Studio</h1>
      <p className="text-muted-foreground mb-6">Creator Studio opens after your Professional Account is approved. Apply as an Individual Creator or a Studio — review takes 3–7 days.</p>
      <Button asChild><Link href="/settings?tab=pro">Apply for Creator</Link></Button>
    </div>
  );
  if (status === "suspended" || status === "banned") return (
    <div className="container px-4 py-20 text-center max-w-lg">
      <h1 className="text-3xl font-bold mb-3">Creator account {status}</h1>
      <p className="text-muted-foreground">Contact support@surituk.com if you think this is a mistake.</p>
    </div>
  );
  const visibleItems = sidebarItems.filter(i => (i.id !== "team" || me.creator?.type === "studio") && (approved || !["store", "sales", "overview"].includes(i.id)));
  const current: Section = !approved && ["overview", "store", "sales"].includes(active) ? "manga" : active;

  const nav = (item: typeof sidebarItems[number], mobile = false) => (
    <button key={item.id} onClick={() => setActive(item.id)}
      className={mobile
        ? `flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 shrink-0 ${current === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`
        : `w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${current === item.id ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}>
      {item.icon} {item.label}
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/20 p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Creator Studio</p>
        <div className="flex items-center gap-2 mb-6">
          <img src={creator?.avatar ?? me.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          <p className="text-sm font-medium truncate">{creator?.name ?? me.creator?.name}{creator?.isVerified && <CheckCircle className="w-3 h-3 text-primary inline ml-1" />}</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="w-full justify-start mb-2 text-muted-foreground"><Link href="/"><Home className="w-4 h-4 mr-2" /> Back to Home</Link></Button>
        <nav className="space-y-1">{visibleItems.map(i => nav(i))}</nav>
      </aside>
      <div className="md:hidden border-b border-border bg-card/30 sticky top-16 z-40"><div className="flex overflow-x-auto px-2">{visibleItems.map(i => nav(i, true))}</div></div>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {!approved && (
          <div className="mb-6 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1"><b>Your application is under review.</b> You can prepare <b>private drafts</b> now — they can be published after approval.</span>
            <Link href="/settings?tab=pro" className="text-accent underline shrink-0">View status</Link>
          </div>
        )}
        {current === "overview" && (
          <div>
            <h1 className="text-3xl font-bold mb-6">Overview</h1>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[
                { label: "Total Views", value: analytics?.totalViews.toLocaleString() ?? "—", icon: <Eye className="w-5 h-5 text-primary" /> },
                { label: "Total Likes", value: analytics?.totalLikes.toLocaleString() ?? "—", icon: <Heart className="w-5 h-5 text-primary" /> },
                { label: "Followers", value: analytics?.totalFollowers.toLocaleString() ?? "—", icon: <Users className="w-5 h-5 text-accent" /> },
              ].map(c => (
                <div key={c.label} className="p-4 rounded-xl border border-border bg-card/40">
                  {c.icon}<div className="text-2xl font-bold mt-2">{c.value}</div><div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>
            {analytics && analytics.viewsByDay.length > 0 && (
              <div className={`${card} mb-6`}>
                <h2 className="text-base font-semibold mb-4">Views this week</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={analytics.viewsByDay}>
                    <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={RED} stopOpacity={0.4} /><stop offset="95%" stopColor={RED} stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="date" tick={{ fill: "hsl(30 12% 62%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(30 12% 62%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(22 12% 8%)", border: "1px solid hsl(24 12% 15%)", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="views" stroke={RED} fill="url(#grad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {(analytics?.topManga ?? []).length > 0 && (
              <div className={card}>
                <h2 className="text-base font-semibold mb-4">Top series</h2>
                <div className="space-y-3">{analytics!.topManga!.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Link href={`/manga/${m.id}`} className="flex-1 text-sm hover:text-primary">{m.title}</Link>
                    <span className="text-sm text-muted-foreground">{m.views.toLocaleString()} views</span><ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        )}

        {current === "manga" && managing !== null && <ManageSeries seriesId={managing} onBack={() => setManaging(null)} />}
        {current === "manga" && managing === null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold">My Graphic Novels</h1>
              <Button onClick={() => setActive("upload-manga")}><Plus className="w-4 h-4 mr-1.5" /> New series</Button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Click a series to edit details, change chapter pages, or delete it.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {myManga.map(m => (
                <button key={m.id} onClick={() => setManaging(m.id)} className="group text-left">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border mb-2">
                    <img src={m.coverImage} alt="" className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${m.isPublished ? "bg-green-600/90" : "bg-black/80"}`}>{m.isPublished ? "Published" : "Draft"}</span>
                      {m.isMature && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/90">18+</span>}
                    </div>
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 text-xs py-1.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">Manage</span>
                  </div>
                  <p className="text-sm font-medium line-clamp-2 group-hover:text-primary">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.chapterCount} chapters · {m.views.toLocaleString()} views</p>
                </button>
              ))}
              {myManga.length === 0 && <div className="col-span-full text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">No graphic novels yet. Create your first series.</div>}
            </div>
          </div>
        )}

        {current === "upload-manga" && <UploadManga canPublish={approved} onDone={() => setActive("upload-chapter")} />}
        {current === "upload-chapter" && <UploadChapter myManga={myManga} />}
        {current === "store" && <SellBooks />}
        {current === "sales" && <Sales goSettings={() => setActive("settings")} />}
        {current === "team" && <StudioTeam />}
        {current === "settings" && <CreatorSettings />}
      </main>
    </div>
  );
}
