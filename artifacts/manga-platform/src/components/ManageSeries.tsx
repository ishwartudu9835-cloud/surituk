import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListGenres } from "@workspace/api-client-react";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Pencil, FileUp, Loader2, X, ExternalLink, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { api, uploadFiles } from "@/lib/api";
import { pdfToImages } from "@/lib/pdf";
import { useAuth } from "@/lib/auth";
import { Checkbox } from "@/components/ui/checkbox";

type Series = { isPublished: boolean; isMature: boolean; id: number; title: string; description: string | null; coverImage: string; bannerImage: string | null; genre: string; language: string; status: string; tags: string[] | null; chapterCount: number };
type Chapter = { id: number; chapterNumber: number; title: string; pages: string[]; createdAt: string };

const card = "p-6 rounded-xl border border-border bg-card/40";
const label = "text-sm font-medium mb-1.5 block";
const LANGUAGES = ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Japanese", "Korean", "Other"];
const naturalSort = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

/* ---------- Chapter page editor ---------- */

type PageItem = { key: string; url?: string; file?: File; preview: string };
let seq = 0;
const fromUrl = (url: string): PageItem => ({ key: `u${seq++}`, url, preview: url });
const fromFile = (file: File): PageItem => ({ key: `f${seq++}`, file, preview: URL.createObjectURL(file) });

function ChapterEditor({ chapter, onClose }: { chapter: Chapter; onClose: () => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(chapter.title);
  const [num, setNum] = useState(String(chapter.chapterNumber));
  const [items, setItems] = useState<PageItem[]>(() => chapter.pages.map(fromUrl));
  const [insertAt, setInsertAt] = useState<number | null>(null); // null = add at end
  const [converting, setConverting] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");

  async function add(list: FileList | null, replaceAll = false) {
    if (!list) return;
    const all = Array.from(list);
    const imgs = all.filter(f => f.type.startsWith("image/")).sort(naturalSort);
    const pdfs = all.filter(f => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    const newItems: PageItem[] = imgs.map(fromFile);
    for (const pdf of pdfs) {
      try {
        setConverting(`Reading ${pdf.name}…`);
        const pages = await pdfToImages(pdf, (d, t) => setConverting(`Converting ${pdf.name}: page ${d} of ${t}`));
        newItems.push(...pages.map(fromFile));
      } catch { setErr(`Could not read ${pdf.name}`); }
    }
    setConverting(null);
    setItems(prev => {
      if (replaceAll) return newItems;
      const at = insertAt === null ? prev.length : insertAt;
      return [...prev.slice(0, at), ...newItems, ...prev.slice(at)].slice(0, 300);
    });
    setInsertAt(null);
  }
  const move = (i: number, d: -1 | 1) => setItems(prev => {
    const n = [...prev]; const j = i + d; if (j < 0 || j >= n.length) return prev;
    [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const replaceOne = useRef<number | null>(null);
  const oneInput = useRef<HTMLInputElement>(null);

  async function save() {
    setErr("");
    if (!items.length) { setErr("A chapter needs at least one page"); return; }
    try {
      const files = items.filter(i => i.file).map(i => i.file!);
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i += 20) {
        const batch = files.slice(i, i + 20);
        const r = await uploadFiles<{ urls: string[] }>("/uploads/images", "files", batch, p => setPct(Math.round(((i + (p / 100) * batch.length) / files.length) * 100)));
        uploaded.push(...r.urls);
      }
      let k = 0;
      const pages = items.map(it => it.url ?? uploaded[k++]);
      setPct(100);
      await api(`/studio/chapters/${chapter.id}`, { method: "PATCH", body: { title, chapterNumber: Number(num), pages } });
      qc.invalidateQueries();
      onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setPct(null); }
  }

  const busy = pct !== null || !!converting;
  const newCount = items.filter(i => i.file).length;

  return (
    <div className={`${card} space-y-5`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Edit chapter pages</h2>
        <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>
      <div className="grid sm:grid-cols-[120px_1fr] gap-3">
        <div><label className={label}>Chapter #</label><Input type="number" step="0.1" min="0" value={num} onChange={e => setNum(e.target.value)} /></div>
        <div><label className={label}>Title</label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => { setInsertAt(null); input.current?.click(); }}><FileUp className="w-4 h-4 mr-2" /> Add pages at end</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => { if (confirm("Replace ALL pages of this chapter with new files?")) { input.current!.dataset.replace = "1"; input.current?.click(); } }}><Images className="w-4 h-4 mr-2" /> Replace all pages</Button>
        <p className="text-xs text-muted-foreground self-center">Images or PDF. Hover a page to move, replace or delete it.</p>
      </div>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" className="hidden"
        onChange={e => { const r = e.target.dataset.replace === "1"; e.target.dataset.replace = ""; add(e.target.files, r); e.target.value = ""; }} />
      <input ref={oneInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; const i = replaceOne.current; if (f && i !== null) setItems(prev => prev.map((it, j) => j === i ? fromFile(f) : it)); e.target.value = ""; }} />

      {converting && <p className="text-sm text-accent flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {converting}</p>}

      <div>
        <p className="text-sm mb-2">{items.length} pages{newCount ? ` · ${newCount} new (will upload on save)` : ""}</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2 max-h-[28rem] overflow-y-auto pr-1">
          {items.map((it, i) => (
            <div key={it.key} className="relative group">
              <img src={it.preview} alt="" className={`aspect-[3/4] w-full object-cover rounded-md border ${it.file ? "border-accent" : "border-border"}`} />
              <span className="absolute top-1 left-1 text-[10px] bg-black/75 rounded px-1">{i + 1}</span>
              {it.file && <span className="absolute top-1 right-1 text-[9px] bg-accent text-accent-foreground rounded px-1">NEW</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 bg-black/70">
                <button type="button" title="Move left" onClick={() => move(i, -1)}><ArrowUp className="w-3.5 h-3.5 -rotate-90" /></button>
                <button type="button" title="Replace this page" onClick={() => { replaceOne.current = i; oneInput.current?.click(); }}><Pencil className="w-3.5 h-3.5" /></button>
                <button type="button" title="Insert pages before this" onClick={() => { setInsertAt(i); input.current?.click(); }}><FileUp className="w-3.5 h-3.5" /></button>
                <button type="button" title="Delete page" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                <button type="button" title="Move right" onClick={() => move(i, 1)}><ArrowDown className="w-3.5 h-3.5 -rotate-90" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {pct !== null && <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>}
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button className="flex-1" onClick={save} disabled={busy}>{pct !== null ? `Saving… ${pct}%` : "Save chapter"}</Button>
      </div>
    </div>
  );
}

/* ---------- Manage one series ---------- */

export function ManageSeries({ seriesId, onBack }: { seriesId: number; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: genres } = useListGenres();
  const { me } = useAuth();
  const canPublish = me?.creator?.status === "approved";
  const { data: s, isLoading } = useQuery({ queryKey: ["studio-series", seriesId], queryFn: () => api<Series>(`/studio/series/${seriesId}`) });
  const [pubBusy, setPubBusy] = useState(false);
  const { data: chapters } = useQuery({ queryKey: ["studio-chapters", seriesId], queryFn: () => api<Chapter[]>(`/manga/${seriesId}/chapters`) });
  const [f, setF] = useState<Partial<Series> & { tagsText?: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  const [busy, setBusy] = useState(false);

  const form = useMemo(() => f ?? (s ? { ...s, tagsText: (s.tags ?? []).join(", ") } : null), [f, s]);
  const sorted = useMemo(() => [...(chapters ?? [])].sort((a, b) => a.chapterNumber - b.chapterNumber), [chapters]);

  if (isLoading || !form) return <Loader2 className="w-6 h-6 animate-spin text-primary" />;
  const set = (patch: Partial<Series> & { tagsText?: string }) => setF({ ...form, ...patch });

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    try {
      await api(`/studio/series/${seriesId}`, { method: "PATCH", body: {
        title: form!.title, description: form!.description ?? "", genre: form!.genre, language: form!.language, status: form!.status,
        coverImage: form!.coverImage, bannerImage: form!.bannerImage ?? "", isMature: !!form!.isMature,
        tags: (form!.tagsText ?? "").split(",").map(t => t.trim()).filter(Boolean),
      } });
      qc.invalidateQueries();
      setMsg({ ok: true, t: "Saved" });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  }

  async function setPublished(isPublished: boolean) {
    setPubBusy(true); setMsg(null);
    try { await api(`/studio/series/${seriesId}`, { method: "PATCH", body: { isPublished } }); qc.invalidateQueries(); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    finally { setPubBusy(false); }
  }

  async function deleteChapter(ch: Chapter) {
    if (!confirm(`Delete Chapter ${ch.chapterNumber}: "${ch.title}"? This can't be undone.`)) return;
    await api(`/studio/chapters/${ch.id}`, { method: "DELETE" });
    qc.invalidateQueries();
  }

  async function deleteSeries() {
    setBusy(true);
    try { await api(`/studio/series/${seriesId}`, { method: "DELETE" }); qc.invalidateQueries(); onBack(); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); setBusy(false); setDelOpen(false); }
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> All series</Button>
        <h1 className="text-3xl font-bold flex-1 min-w-0 truncate">{s?.title}</h1>
        <Button asChild variant="outline" size="sm"><Link href={`/manga/${seriesId}`}><ExternalLink className="w-4 h-4 mr-1.5" /> View page</Link></Button>
      </div>

      <div className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3 ${s?.isPublished ? "border-green-500/30 bg-green-500/5" : "border-border bg-card/40"}`}>
        <div className="flex-1">
          <p className="font-semibold">{s?.isPublished ? "✓ Published — readers can see this series" : "Draft — only you can see this series"}</p>
          <p className="text-xs text-muted-foreground">{s?.isPublished ? "Unpublish to hide it again." : canPublish ? "Add at least one chapter, then publish." : "You can publish after your creator account is approved."}</p>
        </div>
        {s?.isPublished
          ? <Button variant="outline" disabled={pubBusy} onClick={() => setPublished(false)}>Unpublish</Button>
          : <Button disabled={pubBusy || !canPublish} onClick={() => setPublished(true)}>{pubBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish series"}</Button>}
      </div>
      {msg && !msg.ok && <p className="text-sm text-red-400 -mt-4">{msg.t}</p>}

      {editing ? <ChapterEditor key={editing.id} chapter={editing} onClose={() => setEditing(null)} /> : (
        <div className={card}>
          <h2 className="text-xl font-bold mb-4">Chapters ({sorted.length})</h2>
          <div className="divide-y divide-border">
            {sorted.map(ch => (
              <div key={ch.id} className="flex items-center gap-3 py-3">
                <img src={ch.pages[0]} alt="" className="w-10 h-14 object-cover rounded border border-border bg-secondary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">Chapter {ch.chapterNumber}: {ch.title}</p>
                  <p className="text-xs text-muted-foreground">{ch.pages.length} pages · {new Date(ch.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(ch)}><Pencil className="w-4 h-4 mr-1.5" /> Edit pages</Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => deleteChapter(ch)} aria-label="Delete chapter"><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            {sorted.length === 0 && <p className="text-muted-foreground py-4">No chapters yet. Use "Upload Chapter" to add one.</p>}
          </div>
        </div>
      )}

      <form onSubmit={saveDetails} className={`${card} grid md:grid-cols-[200px_1fr] gap-6`}>
        <div className="space-y-4">
          <div><label className={label}>Cover</label><ImageUpload value={form.coverImage ?? ""} onChange={coverImage => set({ coverImage })} /></div>
          <div><label className={label}>Banner</label><ImageUpload value={form.bannerImage ?? ""} onChange={bannerImage => set({ bannerImage })} aspect="aspect-[16/7]" label="Upload banner" /></div>
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Series details</h2>
          <div><label className={label}>Title</label><Input value={form.title ?? ""} onChange={e => set({ title: e.target.value })} /></div>
          <div><label className={label}>Description</label><Textarea rows={5} value={form.description ?? ""} onChange={e => set({ description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={label}>Genre</label><select value={form.genre} onChange={e => set({ genre: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-2 text-sm">{genres?.map(g => <option key={g.id}>{g.name}</option>)}</select></div>
            <div><label className={label}>Language</label><select value={form.language} onChange={e => set({ language: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-2 text-sm">{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></div>
            <div><label className={label}>Status</label><select value={form.status} onChange={e => set({ status: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-2 text-sm"><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="hiatus">On break</option></select></div>
          </div>
          <div><label className={label}>Tags</label><Input value={form.tagsText ?? ""} onChange={e => set({ tagsText: e.target.value })} placeholder="comma separated" /></div>
          <label className="flex items-start gap-3 cursor-pointer text-sm">
            <Checkbox checked={!!form.isMature} onCheckedChange={v => set({ isMature: v === true })} className="mt-0.5" />
            <span><b>18+ / mature content</b> <span className="text-muted-foreground">— hidden from readers who haven't confirmed 18+.</span></span>
          </label>
          {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.t}</p>}
          <Button type="submit" className="w-full">Save details</Button>
        </div>
      </form>

      <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/5">
        <h2 className="text-lg font-bold text-red-400 mb-1">Delete this series</h2>
        <p className="text-sm text-muted-foreground mb-4">Deletes the series, all its chapters, readers' bookmarks and reading history. This can't be undone. Books you sell in the Store are not affected.</p>
        <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10" onClick={() => { setDelText(""); setDelOpen(true); }}><Trash2 className="w-4 h-4 mr-2" /> Delete series</Button>
      </div>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete "{s?.title}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Type <b className="text-foreground">DELETE</b> to confirm.</p>
          <Input value={delText} onChange={e => setDelText(e.target.value)} placeholder="DELETE" autoFocus />
          <Button disabled={delText !== "DELETE" || busy} onClick={deleteSeries} className="bg-red-600 hover:bg-red-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete forever"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
