import { useState } from "react";
import { creatorHref } from "@/lib/links";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, HelpCircle, Copy, ExternalLink, Loader2, ShieldCheck, BadgeCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Overview = { users: number; creators: number; studios: number; pendingApplications: number; series: number; drafts: number; newCreatorMode: "manual" | "auto" };
type App = {
  id: number; userId: number; type: string; status: string; legalName: string; penName: string; email: string; mobile: string; mobileMasked: string;
  city: string; state: string; portfolioUrl: string | null; sampleImages: string[]; socialLinks: Record<string, string>;
  verificationCode: string; codeVerified: boolean; studioName: string | null; studioDescription: string | null; studioLogo: string | null;
  website: string | null; udyamNumber: string | null; gstNumber: string | null; teamMembers: { name: string; email: string; role: string }[];
  reviewNote: string | null; accountEmail: string | null; accountJoinedAt: string | null; daysWaiting: number; createdAt: string; inviteToken: string | null;
};
type Creator = { id: number; name: string; type: string; status: string; avatar: string; city: string | null; state: string | null; isVerified: boolean; isRegisteredStudio: boolean; totalManga: number; totalViews: number; followers: number; ownerEmail: string | null; joinedAt: string };
type Invite = { token: string; url: string; note: string | null; usesLeft: number; expiresAt: string | null; createdAt: string };
type Log = { id: number; admin: string | null; action: string; targetType: string | null; targetId: number | null; details: unknown; createdAt: string };

const card = "rounded-xl border border-border bg-card/40 p-5";
const TABS = [["applications", "Applications"], ["creators", "Creators"], ["add", "Add & Invite"], ["audit", "Audit log"]] as const;

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }} className="text-muted-foreground hover:text-primary" aria-label="Copy">{ok ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>;
}

function ApplicationCard({ a }: { a: App }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(a.status === "pending");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [showMobile, setShowMobile] = useState(false);

  async function decide(action: "approve" | "reject" | "more_info") {
    setBusy(action); setErr("");
    try { await api(`/admin/applications/${a.id}/decision`, { body: { action, note } }); qc.invalidateQueries(); }
    catch (e) { setErr((e as Error).message); setBusy(""); }
  }
  async function toggleCode() {
    await api(`/admin/applications/${a.id}`, { method: "PATCH", body: { codeVerified: !a.codeVerified } });
    qc.invalidateQueries({ queryKey: ["admin-apps"] });
  }
  const socials = Object.entries(a.socialLinks ?? {}).filter(([, v]) => v);

  return (
    <div className={card}>
      <button className="w-full flex items-center gap-3 text-left" onClick={() => setOpen(!open)}>
        {a.studioLogo ? <img src={a.studioLogo} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center font-bold">{a.penName[0]}</div>}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{a.type === "studio" ? a.studioName : a.penName} <span className="text-xs font-normal text-muted-foreground capitalize">· {a.type}</span></p>
          <p className="text-xs text-muted-foreground">{a.legalName} · {a.city}, {a.state} · day {a.daysWaiting}{a.inviteToken ? " · invite link" : ""}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "pending" ? "bg-accent/15 text-accent" : a.status === "approved" ? "bg-green-500/15 text-green-400" : a.status === "rejected" ? "bg-red-500/15 text-red-400" : "bg-secondary"}`}>{a.status.replace("_", " ")}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="mt-5 space-y-5 text-sm">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            <p><span className="text-muted-foreground">Account email:</span> {a.accountEmail} ✓</p>
            <p className="flex items-center gap-2"><span className="text-muted-foreground">Mobile:</span> {showMobile ? a.mobile : a.mobileMasked} <button className="text-xs text-primary" onClick={() => setShowMobile(!showMobile)}>{showMobile ? "hide" : "show"}</button> <span className="text-xs text-muted-foreground">(not OTP-verified)</span></p>
            <p><span className="text-muted-foreground">Pen name:</span> {a.penName}</p>
            <p><span className="text-muted-foreground">Account since:</span> {a.accountJoinedAt ? new Date(a.accountJoinedAt).toLocaleDateString("en-IN") : "—"}</p>
            {a.portfolioUrl && <p className="sm:col-span-2"><span className="text-muted-foreground">Portfolio:</span> <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{a.portfolioUrl}</a></p>}
          </div>
          {a.type === "studio" && (
            <div className="rounded-lg bg-secondary/40 p-3 space-y-1">
              <p className="font-semibold">{a.studioName}</p>
              <p className="text-muted-foreground whitespace-pre-line">{a.studioDescription}</p>
              {a.website && <p><a href={a.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">{a.website}</a></p>}
              {(a.udyamNumber || a.gstNumber) && <p className="text-xs">Udyam: {a.udyamNumber ?? "—"} · GST: {a.gstNumber ?? "—"} <span className="text-muted-foreground">(verify, then give the Registered badge in Creators)</span></p>}
              {a.teamMembers.length > 0 && <p className="text-xs">Team: {a.teamMembers.map(m => `${m.name} (${m.role})`).join(", ")}</p>}
            </div>
          )}
          {a.sampleImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">{a.sampleImages.map(u => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="" className="w-24 aspect-[3/4] object-cover rounded-md border border-border hover:border-primary" /></a>)}</div>
          )}
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2">Check that <b className="font-mono text-primary">{a.verificationCode}</b> is in the bio of one of these:</p>
            <div className="flex flex-wrap gap-2 mb-3">{socials.map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-md bg-secondary text-xs flex items-center gap-1 capitalize">{k} <ExternalLink className="w-3 h-3" /></a>)}</div>
            <Button size="sm" variant={a.codeVerified ? "default" : "outline"} onClick={toggleCode}><ShieldCheck className="w-4 h-4 mr-1.5" /> {a.codeVerified ? "Social verified ✓" : "Mark social verified"}</Button>
          </div>
          {a.reviewNote && <p className="text-xs text-muted-foreground">Last note: {a.reviewNote}</p>}
          {["pending", "more_info"].includes(a.status) && (
            <div className="space-y-2">
              <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Note to applicant (required for Reject / More info)" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => decide("approve")} disabled={!!busy} className="bg-green-600 hover:bg-green-700">{busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Approve</>}</Button>
                <Button onClick={() => decide("more_info")} disabled={!!busy} variant="outline"><HelpCircle className="w-4 h-4 mr-1" /> Ask for more info</Button>
                <Button onClick={() => decide("reject")} disabled={!!busy} variant="outline" className="border-red-500/50 text-red-400"><X className="w-4 h-4 mr-1" /> Reject</Button>
              </div>
              {err && <p className="text-red-400">{err}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Applications() {
  const [status, setStatus] = useState("pending");
  const { data, isLoading } = useQuery({ queryKey: ["admin-apps", status], queryFn: () => api<App[]>(`/admin/applications?status=${status}`) });
  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {["pending", "more_info", "approved", "rejected", "all"].map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`h-9 px-4 rounded-lg border text-sm capitalize ${status === s ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{s.replace("_", " ")}</button>
        ))}
      </div>
      {isLoading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
      <div className="space-y-3">{data?.map(a => <ApplicationCard key={a.id} a={a} />)}</div>
      {data?.length === 0 && <p className="text-muted-foreground">No applications here.</p>}
    </div>
  );
}

function Creators() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const { data } = useQuery({ queryKey: ["admin-creators", status], queryFn: () => api<Creator[]>(`/admin/creators?status=${status}`) });
  async function patch(id: number, body: Record<string, unknown>) {
    if (body.status === "banned" && !confirm("Ban this creator? Their series will be hidden.")) return;
    await api(`/admin/creators/${id}`, { method: "PATCH", body });
    qc.invalidateQueries({ queryKey: ["admin-creators"] });
  }
  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {["all", "approved", "pending", "suspended", "banned"].map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`h-9 px-4 rounded-lg border text-sm capitalize ${status === s ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{s}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground"><tr>
            <th className="p-3 text-left">Creator</th><th className="p-3 text-left">Owner</th><th className="p-3 text-right">Series</th><th className="p-3 text-right">Views</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Badges</th>
          </tr></thead>
          <tbody>{data?.map(c => (
            <tr key={c.id} className="border-t border-border">
              <td className="p-3"><Link href={creatorHref(c as never)} className="flex items-center gap-2 hover:text-primary"><img src={c.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /><span>{c.name}<span className="block text-xs text-muted-foreground capitalize">{c.type}{c.city ? ` · ${c.city}` : ""}</span></span></Link></td>
              <td className="p-3 text-xs">{c.ownerEmail ?? "—"}</td>
              <td className="p-3 text-right">{c.totalManga}</td>
              <td className="p-3 text-right">{c.totalViews.toLocaleString()}</td>
              <td className="p-3">
                <select value={c.status} onChange={e => patch(c.id, { status: e.target.value })} disabled={c.status === "pending"} className="bg-background border border-border rounded-md h-8 px-2 text-xs">
                  {c.status === "pending" && <option value="pending">pending</option>}
                  <option value="approved">approved</option><option value="suspended">suspended</option><option value="banned">banned</option>
                </select>
              </td>
              <td className="p-3">
                <div className="flex gap-1.5">
                  <button onClick={() => patch(c.id, { isVerified: !c.isVerified })} className={`text-xs px-2 py-1 rounded-md border flex items-center gap-1 ${c.isVerified ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}><ShieldCheck className="w-3 h-3" /> Verified</button>
                  {c.type === "studio" && <button onClick={() => patch(c.id, { isRegisteredStudio: !c.isRegisteredStudio })} className={`text-xs px-2 py-1 rounded-md border flex items-center gap-1 ${c.isRegisteredStudio ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground"}`}><BadgeCheck className="w-3 h-3" /> Registered</button>}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function AddAndInvite() {
  const qc = useQueryClient();
  const [f, setF] = useState({ email: "", name: "", type: "individual" });
  const [inv, setInv] = useState({ note: "", uses: "1", days: "14" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const { data: invites } = useQuery({ queryKey: ["admin-invites"], queryFn: () => api<Invite[]>("/admin/invites") });

  async function add(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    try { await api("/admin/creators", { body: f }); setMsg({ ok: true, t: `Creator account created for ${f.email}. They got an email.` }); setF({ email: "", name: "", type: "individual" }); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  }
  async function makeInvite(e: React.FormEvent) {
    e.preventDefault();
    await api("/admin/invites", { body: inv }); setInv({ note: "", uses: "1", days: "14" });
    qc.invalidateQueries({ queryKey: ["admin-invites"] });
  }
  async function disable(token: string) { await api(`/admin/invites/${token}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["admin-invites"] }); }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={add} className={`${card} space-y-3`}>
        <h2 className="text-lg font-bold">Add creator directly</h2>
        <p className="text-sm text-muted-foreground">Creates an approved creator for this email. No review.</p>
        <Input required type="email" placeholder="Their email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <Input required placeholder="Creator / studio name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm"><option value="individual">Individual creator</option><option value="studio">Studio</option></select>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.t}</p>}
        <Button type="submit">Create creator</Button>
      </form>
      <div className={`${card} space-y-3`}>
        <h2 className="text-lg font-bold">Special invite link</h2>
        <p className="text-sm text-muted-foreground">Whoever applies through this link is approved instantly.</p>
        <form onSubmit={makeInvite} className="grid grid-cols-[1fr_70px_70px_auto] gap-2 items-end">
          <div><label className="text-xs text-muted-foreground">Note</label><Input value={inv.note} onChange={e => setInv({ ...inv, note: e.target.value })} placeholder="e.g. Comic Con 2026" /></div>
          <div><label className="text-xs text-muted-foreground">Uses</label><Input type="number" min="1" value={inv.uses} onChange={e => setInv({ ...inv, uses: e.target.value })} /></div>
          <div><label className="text-xs text-muted-foreground">Days</label><Input type="number" min="1" value={inv.days} onChange={e => setInv({ ...inv, days: e.target.value })} /></div>
          <Button type="submit">Create</Button>
        </form>
        <div className="space-y-2 pt-2">
          {invites?.map(i => {
            const live = i.usesLeft > 0 && (!i.expiresAt || new Date(i.expiresAt) > new Date());
            return (
              <div key={i.token} className={`flex items-center gap-2 text-xs p-2 rounded-lg border border-border ${live ? "" : "opacity-50"}`}>
                <span className="flex-1 truncate font-mono">{i.url}</span><CopyBtn text={i.url} />
                <span className="text-muted-foreground whitespace-nowrap">{i.note ?? ""} · {i.usesLeft} left</span>
                {live && <button onClick={() => disable(i.token)} className="text-red-400" aria-label="Disable"><X className="w-4 h-4" /></button>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Audit() {
  const { data } = useQuery({ queryKey: ["admin-audit"], queryFn: () => api<Log[]>("/admin/audit-log") });
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">When</th><th className="p-3 text-left">Admin</th><th className="p-3 text-left">Action</th><th className="p-3 text-left">Details</th></tr></thead>
        <tbody>{data?.map(l => (
          <tr key={l.id} className="border-t border-border align-top">
            <td className="p-3 whitespace-nowrap text-xs">{new Date(l.createdAt).toLocaleString("en-IN")}</td>
            <td className="p-3 text-xs">{l.admin}</td>
            <td className="p-3 font-mono text-xs">{l.action}{l.targetId ? ` #${l.targetId}` : ""}</td>
            <td className="p-3 text-xs text-muted-foreground break-all">{l.details ? JSON.stringify(l.details) : ""}</td>
          </tr>
        ))}</tbody>
      </table>
      {data?.length === 0 && <p className="p-6 text-muted-foreground">No admin actions yet.</p>}
    </div>
  );
}

export default function Admin() {
  const { me, loading } = useAuth();
  const qc = useQueryClient();
  const isAdmin = me?.role === "admin";
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("applications");
  const { data: o } = useQuery({ queryKey: ["admin-overview"], queryFn: () => api<Overview>("/admin/overview"), enabled: isAdmin });
  const { data: storage } = useQuery({ queryKey: ["storage-status"], queryFn: () => api<{ mode: string; ok: boolean; persistent: boolean; error?: string; advice: string }>("/storage-status"), enabled: isAdmin });

  async function setMode(mode: "manual" | "auto") {
    await api("/admin/settings", { method: "PATCH", body: { newCreatorMode: mode } });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  if (loading) return null;
  if (!isAdmin) return <div className="container px-4 py-20 text-center text-muted-foreground">Admins only. <Link href="/" className="text-primary">Home</Link></div>;

  return (
    <div className="container px-4 py-10">
      <h1 className="text-4xl font-bold mb-8">Admin</h1>
      {storage && (!storage.ok || !storage.persistent) && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm" data-testid="storage-warning">
          <p className="font-semibold text-red-400 mb-1">⚠️ Photo storage problem ({storage.mode})</p>
          <p className="text-muted-foreground">{storage.advice}</p>
          {storage.error && <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{storage.error}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[["Readers", o?.users], ["Creators", o?.creators], ["Studios", o?.studios], ["Waiting review", o?.pendingApplications], ["Published series", o?.series], ["Drafts", o?.drafts]].map(([l, v]) => (
          <div key={String(l)} className="p-4 rounded-xl border border-border bg-card/40"><div className="text-2xl font-bold">{v ?? "—"}</div><div className="text-xs text-muted-foreground mt-1">{l}</div></div>
        ))}
      </div>
      <div className={`${card} mb-8 flex flex-col sm:flex-row sm:items-center gap-3`}>
        <div className="flex-1"><p className="font-semibold">New creator mode</p><p className="text-sm text-muted-foreground">Manual: you review every application. Auto: applications are approved instantly.</p></div>
        <div className="flex gap-2">
          {(["manual", "auto"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`h-10 px-5 rounded-lg border text-sm font-medium ${o?.newCreatorMode === m ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{m === "manual" ? "Manual approval" : "Auto approve"}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {label}{id === "applications" && o?.pendingApplications ? <span className="ml-1.5 text-xs px-1.5 rounded-full bg-primary text-primary-foreground">{o.pendingApplications}</span> : null}
          </button>
        ))}
      </div>
      {tab === "applications" && <Applications />}
      {tab === "creators" && <Creators />}
      {tab === "add" && <AddAndInvite />}
      {tab === "audit" && <Audit />}
    </div>
  );
}
