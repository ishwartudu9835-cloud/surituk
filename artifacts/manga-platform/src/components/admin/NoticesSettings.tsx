import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { card } from "./shared";
import { useDashboard } from "./Dashboard";

/* ---------------- Notices ---------------- */

type Target = "user" | "creator" | "all_creators" | "all_users";

export function Notices() {
  const [target, setTarget] = useState<Target>("user");
  const [who, setWho] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const { data: creators } = useQuery({ queryKey: ["admin-creators", "approved"], queryFn: () => api<{ id: number; name: string }[]>("/admin/creators?status=approved"), enabled: target === "creator" });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if ((target === "all_users" || target === "all_creators") && !confirm(`Send this to ${target === "all_users" ? "every user" : "every creator"}?`)) return;
    setBusy(true); setResult(null);
    try {
      const r = await api<{ sent: number }>("/admin/notices", { body: { target, email: who, creatorId: Number(creatorId), message } });
      setResult({ ok: true, text: `Sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}. It shows in their notifications.` });
      setMessage("");
    } catch (err) { setResult({ ok: false, text: (err as Error).message }); }
    finally { setBusy(false); }
  }

  const options: [Target, string, string][] = [
    ["user", "One user", "By email or @username"],
    ["creator", "One creator", "Goes to the creator's account"],
    ["all_creators", "All creators", "Every approved creator"],
    ["all_users", "Everyone", "Every user on Surituk"],
  ];

  return (
    <form onSubmit={send} className={`${card} p-4 sm:p-6 space-y-5 max-w-2xl`}>
      <div>
        <p className="text-sm font-semibold mb-2">Send to</p>
        <div className="grid grid-cols-2 gap-2">
          {options.map(([v, title, hint]) => (
            <button key={v} type="button" onClick={() => setTarget(v)} data-testid={`notice-target-${v}`}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${target === v ? "border-primary bg-primary/10" : "border-border hover:border-white/30"}`}>
              <span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      </div>
      {target === "user" && <Input value={who} onChange={e => setWho(e.target.value)} placeholder="name@gmail.com or @username" required data-testid="notice-who" />}
      {target === "creator" && (
        <select value={creatorId} onChange={e => setCreatorId(e.target.value)} required className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Choose a creator…</option>
          {creators?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <div>
        <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={1000} placeholder="Write the notice…" required data-testid="notice-message" />
        <p className="text-xs text-muted-foreground mt-1">{message.length}/1000. Shows in their notifications with a 📢.</p>
      </div>
      {result && <p className={`text-sm flex items-center gap-2 ${result.ok ? "text-emerald-300" : "text-red-400"}`}>{result.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{result.text}</p>}
      <Button type="submit" disabled={busy || message.trim().length < 3} data-testid="notice-send">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send notice</>}</Button>
    </form>
  );
}

/* ---------------- Site settings ---------------- */

export function SiteSettings() {
  const qc = useQueryClient();
  const { data: d } = useDashboard();
  const [banner, setBanner] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => { if (d) setBanner(d.settings.siteBanner); }, [d?.settings.siteBanner]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(body: Record<string, unknown>, label: string) {
    await api("/admin/site-settings", { method: "PATCH", body });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); qc.invalidateQueries({ queryKey: ["site-info"] });
    setSaved(label); setTimeout(() => setSaved(""), 2000);
  }
  if (!d) return <div className={`${card} h-40 animate-pulse`} />;
  const s = d.settings;

  const Choice = ({ on, label, onClick, testid }: { on: boolean; label: string; onClick: () => void; testid?: string }) => (
    <button onClick={onClick} data-testid={testid} className={`h-10 px-4 rounded-lg border text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-white/30"}`}>{label}</button>
  );

  return (
    <div className="space-y-4 max-w-3xl">
      {(!d.storage.ok || !d.storage.persistent) ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm" data-testid="storage-warning">
          <p className="font-semibold text-red-300 mb-1">Photo storage problem ({d.storage.mode})</p>
          <p className="text-muted-foreground">{d.storage.advice}</p>
          {d.storage.error && <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{d.storage.error}</p>}
        </div>
      ) : <p className="text-sm text-emerald-300 flex items-center gap-2"><CheckCircle className="w-4 h-4" />Photo storage is working ({d.storage.mode}).</p>}

      <section className={`${card} p-4 sm:p-5 space-y-3`}>
        <div><h3 className="text-base">New creators</h3><p className="text-sm text-muted-foreground">Manual: you review every application. Auto: they're approved straight away.</p></div>
        <div className="flex flex-wrap gap-2">
          <Choice on={s.newCreatorMode === "manual"} label="Manual approval" onClick={() => save({ newCreatorMode: "manual" }, "Saved")} />
          <Choice on={s.newCreatorMode === "auto"} label="Auto approve" onClick={() => save({ newCreatorMode: "auto" }, "Saved")} />
        </div>
      </section>

      <section className={`${card} p-4 sm:p-5 space-y-3`}>
        <div><h3 className="text-base">New sign-ups</h3><p className="text-sm text-muted-foreground">Pause sign-ups during a spam attack. Existing users can still log in.</p></div>
        <div className="flex flex-wrap gap-2">
          <Choice on={s.signupsOpen} label="Open" onClick={() => save({ signupsOpen: true }, "Sign-ups open")} />
          <Choice on={!s.signupsOpen} label="Paused" onClick={() => save({ signupsOpen: false }, "Sign-ups paused")} testid="signups-pause" />
        </div>
      </section>

      <section className={`${card} p-4 sm:p-5 space-y-3`}>
        <div><h3 className="text-base">Site-wide notice bar</h3><p className="text-sm text-muted-foreground">A yellow bar at the top of every page — for maintenance, contests or big news. Leave empty to hide it.</p></div>
        <Input value={banner} onChange={e => setBanner(e.target.value)} maxLength={300} placeholder="e.g. Diwali special: new chapters every day this week!" data-testid="banner-input" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save({ siteBanner: banner }, "Notice bar saved")} data-testid="banner-save">Save</Button>
          {s.siteBanner && <Button variant="outline" onClick={() => { setBanner(""); save({ siteBanner: "" }, "Notice bar removed"); }}>Remove</Button>}
        </div>
      </section>
      {saved && <p className="text-sm text-emerald-300">{saved}</p>}
    </div>
  );
}
