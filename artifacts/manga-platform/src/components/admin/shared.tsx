import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const card = "rounded-xl border border-border bg-card/50";

export function timeAgo(d: string | null | undefined) {
  if (!d) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-IN");
}

/** Row of filter chips. */
export function Filters<T extends string>({ value, onChange, options }: { value: T; onChange: (v: NoInfer<T>) => void; options: [NoInfer<T>, string, number?][] }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
      {options.map(([v, label, count]) => (
        <button key={v} onClick={() => onChange(v)} data-testid={`filter-${v}`}
          className={`shrink-0 h-8 px-3 rounded-full border text-sm transition-colors ${value === v ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:border-white/30"}`}>
          {label}{count ? <span className="ml-1.5 text-xs px-1.5 rounded-full bg-primary text-primary-foreground">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-14 text-sm text-muted-foreground border border-dashed border-border rounded-xl">{children}</div>;
}

export function Pill({ tone = "muted", children }: { tone?: "muted" | "red" | "green" | "amber" | "blue"; children: React.ReactNode }) {
  const t = { muted: "bg-white/5 text-muted-foreground border-white/10", red: "bg-red-500/15 text-red-300 border-red-500/30", green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", amber: "bg-amber-500/15 text-amber-200 border-amber-500/30", blue: "bg-sky-500/15 text-sky-300 border-sky-500/30" }[tone];
  return <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${t}`}>{children}</span>;
}

/** Confirm dialog that can also collect a reason. Returns a function that opens it. */
export function useConfirm() {
  const [state, setState] = useState<null | { title: string; body?: string; reasonLabel?: string; danger?: boolean; confirmLabel: string; run: (reason: string) => Promise<unknown> }>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ask = (opts: NonNullable<typeof state>) => { setReason(""); setErr(""); setState(opts); };
  const node = (
    <Dialog open={!!state} onOpenChange={o => { if (!o && !busy) setState(null); }}>
      <DialogContent className="bg-background border border-white/10">
        <DialogHeader><DialogTitle>{state?.title}</DialogTitle></DialogHeader>
        {state?.body && <p className="text-sm text-muted-foreground">{state.body}</p>}
        {state?.reasonLabel && <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder={state.reasonLabel} data-testid="confirm-reason" />}
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setState(null)} disabled={busy}>Cancel</Button>
          <Button data-testid="confirm-ok" disabled={busy} className={state?.danger ? "bg-red-600 hover:bg-red-700" : ""}
            onClick={async () => { if (!state) return; setBusy(true); setErr(""); try { await state.run(reason); setState(null); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : state?.confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
  return { ask, node };
}

/** Small action button used in lists. */
export function Act({ onClick, children, danger, testid }: { onClick: () => void; children: React.ReactNode; danger?: boolean; testid?: string }) {
  return (
    <button onClick={onClick} data-testid={testid}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors ${danger ? "border-red-500/40 text-red-300 hover:bg-red-500/10" : "border-border text-foreground/85 hover:bg-white/5"}`}>
      {children}
    </button>
  );
}
