import { useState } from "react";
import { creatorHref } from "@/lib/links";
import { Link, Redirect, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check, X, HelpCircle, Copy, ExternalLink, Loader2, ShieldCheck, BadgeCheck, ChevronDown, ChevronUp, Megaphone, AlertOctagon, Undo2, PauseCircle, Ban,
  User as UserIcon, ScanEye, Trash2, EyeOff, Eye, UserMinus, LayoutDashboard, Flag, Users as UsersIcon, PenTool, FileCheck2, BookOpen, MessagesSquare, Settings as SettingsIcon, ScrollText, Menu, LogOut,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { card as cardBase, Filters, Empty, Pill, useConfirm, Act } from "@/components/admin/shared";
import { Dashboard, type DashboardData } from "@/components/admin/Dashboard";
import { Reports } from "@/components/admin/Reports";
import { Users } from "@/components/admin/Users";
import { Stories, CommunityAdmin } from "@/components/admin/Content";
import { Notices, SiteSettings } from "@/components/admin/NoticesSettings";
import { Deletions } from "@/components/admin/Deletions";
import { FirstChapters, Transfers } from "@/components/admin/Review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type App = {
  id: number; userId: number; type: string; status: string; legalName: string; penName: string; email: string; mobile: string; mobileMasked: string;
  city: string; state: string; portfolioUrl: string | null; sampleImages: string[]; socialLinks: Record<string, string>;
  verificationCode: string; codeVerified: boolean; studioName: string | null; studioDescription: string | null; studioLogo: string | null;
  website: string | null; udyamNumber: string | null; gstNumber: string | null; teamMembers: { name: string; email: string; role: string }[];
  reviewNote: string | null; accountEmail: string | null; accountJoinedAt: string | null; daysWaiting: number; createdAt: string; inviteToken: string | null;
};
type Creator = { id: number; name: string; slug: string | null; type: string; status: string; avatar: string; city: string | null; state: string | null; isVerified: boolean; isRegisteredStudio: boolean; totalManga: number; totalViews: number; followers: number; ownerEmail: string | null; ownerUserId: number | null; strikes: number; hidden: boolean; joinedAt: string };
type Invite = { token: string; url: string; note: string | null; usesLeft: number; expiresAt: string | null; createdAt: string };
type Log = { id: number; admin: string | null; action: string; targetType: string | null; targetId: number | null; details: unknown; createdAt: string };

const card = `${cardBase} p-5`;

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
  const { ask, node } = useConfirm();
  const [status, setStatus] = useState<"all" | "approved" | "pending" | "suspended" | "revoked" | "banned" | "deleted">("all");
  const [view, setView] = useState<"list" | "transfers" | "add">(new URLSearchParams(window.location.search).get("view") === "transfers" ? "transfers" : "list");
  const { data } = useQuery({ queryKey: ["admin-creators", status], queryFn: () => api<Creator[]>(`/admin/creators?status=${status}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-creators"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); };
  async function patch(id: number, body: Record<string, unknown>) {
    await api(`/admin/creators/${id}`, { method: "PATCH", body });
    refresh();
  }
  return (
    <div className="space-y-4">
      <Filters value={view} onChange={setView} options={[["list", "All creators"], ["transfers", "Ownership transfers"], ["add", "Add creator & invite links"]]} />
      {view === "transfers" ? <Transfers /> : view === "add" ? <AddAndInvite /> : (
        <>
          <Filters value={status} onChange={setStatus} options={[["all", "All"], ["approved", "Active"], ["pending", "Pending"], ["suspended", "Suspended"], ["revoked", "Powers removed"], ["banned", "Banned"], ["deleted", "Deleted"]]} />
          <ul className="space-y-3">
            {data?.map(c => (
              <li key={c.id} className={`${card} p-4 space-y-3`} data-testid={`creator-row-${c.id}`}>
                <div className="flex items-center gap-3">
                  <img src={c.avatar} alt={c.name} className="w-11 h-11 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Link href={creatorHref(c as never)} className="font-semibold hover:text-primary">{c.name}</Link>
                    <p className="text-xs text-muted-foreground truncate">{c.type === "studio" ? "Studio" : "Creator"}{c.city ? `, ${c.city}` : ""} — {c.ownerEmail ?? "no owner"}</p>
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    <Pill tone={c.status === "approved" ? "green" : c.status === "pending" ? "muted" : "red"}>{c.status === "approved" ? "active" : c.status === "revoked" ? "powers removed" : c.status}</Pill>
                    {c.hidden && <Pill tone="red">hidden</Pill>}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{c.totalManga} stories, {c.totalViews.toLocaleString("en-IN")} views, {c.followers} subscribers{c.strikes ? `, ${c.strikes} of 3 strikes` : ""}</p>
                <div className="flex flex-wrap gap-2">
                  {c.type === "studio" && <Act onClick={() => patch(c.id, { isVerified: !c.isVerified })}><ShieldCheck className="w-3.5 h-3.5" />{c.isVerified ? "Remove verified" : "Verify"}</Act>}
                  {c.type === "studio" && <Act onClick={() => patch(c.id, { isRegisteredStudio: !c.isRegisteredStudio })}><BadgeCheck className="w-3.5 h-3.5" />{c.isRegisteredStudio ? "Remove registered" : "Registered studio"}</Act>}
                  <Act onClick={() => ask({ title: `Send a notice to ${c.name}`, reasonLabel: "Message", confirmLabel: "Send", run: async m => { if (m.trim().length < 3) throw new Error("Write a message"); await api("/admin/notices", { body: { target: "creator", creatorId: c.id, message: m } }); } })}><Megaphone className="w-3.5 h-3.5" />Notice</Act>
                  {c.status === "approved" && <Act onClick={() => ask({ title: `Strike ${c.name}?`, body: "3 strikes suspends the account. They get your reason.", reasonLabel: "Reason (required)", confirmLabel: "Give strike", danger: true, run: async r => { if (!r.trim()) throw new Error("Write a reason"); await api(`/admin/creators/${c.id}/strike`, { body: { reason: r } }); refresh(); } })} testid={`strike-${c.id}`}><AlertOctagon className="w-3.5 h-3.5" />Strike</Act>}
                  {!!c.strikes && <Act onClick={() => api(`/admin/creators/${c.id}/clear-strikes`, { body: {} }).then(refresh)}><Undo2 className="w-3.5 h-3.5" />Clear strikes</Act>}
                  {c.status !== "deleted" && (c.hidden
                    ? <Act onClick={() => patch(c.id, { hidden: false })}><Eye className="w-3.5 h-3.5" />Unhide</Act>
                    : <Act testid={`hide-${c.id}`} onClick={() => ask({ title: `Hide ${c.name}?`, body: "Their creator page and all stories disappear for readers. They can still log in. They get a notice with your reason.", reasonLabel: "Reason (sent to them)", confirmLabel: "Hide creator", danger: true, run: r => patch(c.id, { hidden: true, reason: r }) })}><EyeOff className="w-3.5 h-3.5" />Hide</Act>)}
                  {c.status === "approved" && <Act danger testid={`revoke-${c.id}`} onClick={() => ask({ title: `Remove ${c.name}'s creator powers?`, body: "They become a normal reader: no Creator Studio, no publishing, no posts. Their stories are hidden. You can restore it later.", reasonLabel: "Reason (sent to them)", confirmLabel: "Remove powers", danger: true, run: r => patch(c.id, { status: "revoked", reason: r }) })}><UserMinus className="w-3.5 h-3.5" />Remove creator powers</Act>}
                  {c.status === "approved" && <Act danger onClick={() => ask({ title: `Suspend ${c.name}?`, body: "Their stories are hidden and they can't publish until you restore them.", reasonLabel: "Reason (sent to them)", confirmLabel: "Suspend", danger: true, run: r => patch(c.id, { status: "suspended", reason: r }) })}><PauseCircle className="w-3.5 h-3.5" />Suspend</Act>}
                  {["suspended", "banned", "revoked"].includes(c.status) && <Act onClick={() => patch(c.id, { status: "approved" })}><Undo2 className="w-3.5 h-3.5" />Restore</Act>}
                  {!["banned", "pending", "deleted"].includes(c.status) && <Act danger onClick={() => ask({ title: `Ban ${c.name}?`, body: "Permanent. All their stories are hidden.", reasonLabel: "Reason (sent to them)", confirmLabel: "Ban creator", danger: true, run: r => patch(c.id, { status: "banned", reason: r }) })}><Ban className="w-3.5 h-3.5" />Ban</Act>}
                  {c.status !== "deleted" && <Act danger testid={`delete-creator-${c.id}`} onClick={() => ask({ title: `Delete ${c.name}?`, body: `Right now, can't be undone: this ${c.type === "studio" ? "studio" : "creator account"}, all ${c.totalManga} stories with chapters, its community posts, team and subscribers. The owner keeps a normal reader account (delete that from Users if needed). They get a notice with your reason.`, reasonLabel: "Reason (required, sent to them)", confirmLabel: "Delete permanently", danger: true, run: async r => { if (r.trim().length < 3) throw new Error("Write a reason"); await api(`/admin/creators/${c.id}/delete`, { body: { reason: r } }); refresh(); } })}><Trash2 className="w-3.5 h-3.5" />Delete</Act>}
                  {c.ownerUserId && <Link href={`/admin/users?id=${c.ownerUserId}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs hover:bg-white/5"><UserIcon className="w-3.5 h-3.5" />Owner account</Link>}
                </div>
              </li>
            ))}
          </ul>
          {data?.length === 0 && <Empty>No creators here.</Empty>}
        </>
      )}
      {node}
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

const SECTIONS = [
  { id: "", label: "Dashboard", icon: LayoutDashboard },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "users", label: "Users", icon: UsersIcon },
  { id: "creators", label: "Creators", icon: PenTool },
  { id: "applications", label: "Applications", icon: FileCheck2 },
  { id: "stories", label: "Stories", icon: BookOpen },
  { id: "first-chapters", label: "First chapters", icon: ScanEye },
  { id: "community", label: "Community", icon: MessagesSquare },
  { id: "deletions", label: "Deletion requests", icon: Trash2 },
  { id: "notices", label: "Send notice", icon: Megaphone },
  { id: "settings", label: "Site settings", icon: SettingsIcon },
  { id: "audit", label: "Audit log", icon: ScrollText },
] as const;

function Nav({ current, counts, onPick }: { current: string; counts: Record<string, number>; onPick?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Admin sections">
      {SECTIONS.map(({ id, label, icon: Icon }) => {
        const active = current === id;
        return (
          <Link key={id} href={id ? `/admin/${id}` : "/admin"} onClick={onPick} data-testid={`admin-nav-${id || "dashboard"}`}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-primary/15 text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"}`}>
            <Icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} />
            <span className="flex-1">{label}</span>
            {counts[id] ? <span className="text-[11px] min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">{counts[id]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Admin() {
  const { me, loading, logout } = useAuth();
  const params = useParams<{ section?: string }>();
  const current = params.section ?? "";
  const [menu, setMenu] = useState(false);
  const isAdmin = me?.role === "admin";
  const { data: d } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => api<DashboardData>("/admin/dashboard"), enabled: isAdmin, refetchInterval: 60_000 });

  if (loading) return null;
  if (!me) return <Redirect to="/login?next=/admin" />;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-6 text-center">This area is for Surituk admins only. <Link href="/" className="text-primary ml-1">Go home</Link></div>;

  const counts: Record<string, number> = { reports: d?.reports.open ?? 0, applications: d?.creators.pendingApplications ?? 0, deletions: d?.deletions?.scheduled ?? 0, "first-chapters": d?.review?.chapters ?? 0, creators: d?.review?.transfers ?? 0 };
  const section = SECTIONS.find(x => x.id === current) ?? SECTIONS[0];
  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5 px-3">
      <img src={`${import.meta.env.BASE_URL}surituk-mark.svg`} alt="" className="w-8 h-8" />
      <span className="font-display text-lg font-bold leading-none">Surituk<span className="block text-xs font-sans font-normal text-muted-foreground mt-0.5">Admin</span></span>
    </Link>
  );
  const footer = (
    <div className="space-y-1 border-t border-border pt-3">
      <div className="flex items-center gap-2.5 px-3 py-2">
        <img src={me.avatar} alt={me.displayName} className="w-7 h-7 rounded-full object-cover" />
        <span className="text-xs min-w-0"><span className="block truncate">{me.displayName}</span><span className="block text-muted-foreground truncate">{me.email}</span></span>
      </div>
      <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"><ExternalLink className="w-4 h-4" />View site</Link>
      <button onClick={() => logout()} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"><LogOut className="w-4 h-4" />Log out</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col gap-5 sticky top-0 h-screen border-r border-border bg-card/40 p-3 pt-5">
        {brand}
        <div className="flex-1 overflow-y-auto"><Nav current={current} counts={counts} /></div>
        {footer}
      </aside>

      {/* Phone top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-3 border-b border-border bg-background/95 backdrop-blur">
        <button onClick={() => setMenu(true)} className="w-10 h-10 -ml-1 flex items-center justify-center rounded-lg hover:bg-white/5 relative" aria-label="Open admin menu" data-testid="admin-menu">
          <Menu className="w-5 h-5" />
          {(counts.reports + counts.applications) > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />}
        </button>
        <span className="font-display font-bold text-lg flex-1 truncate">{section.label}</span>
        <img src={`${import.meta.env.BASE_URL}surituk-mark.svg`} alt="Surituk admin" className="w-7 h-7" />
      </header>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-72 p-3 pt-5 flex flex-col gap-5 bg-background">
          <SheetHeader className="sr-only"><SheetTitle>Admin menu</SheetTitle></SheetHeader>
          {brand}
          <div className="flex-1 overflow-y-auto"><Nav current={current} counts={counts} onPick={() => setMenu(false)} /></div>
          {footer}
        </SheetContent>
      </Sheet>

      <main className="min-w-0 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-6xl">
        <h1 className="hidden lg:block text-3xl mb-6">{section.label}</h1>
        {current === "" && <Dashboard />}
        {current === "reports" && <Reports />}
        {current === "users" && <Users />}
        {current === "creators" && <Creators />}
        {current === "applications" && <Applications />}
        {current === "stories" && <Stories />}
        {current === "first-chapters" && <FirstChapters />}
        {current === "community" && <CommunityAdmin />}
        {current === "deletions" && <Deletions />}
        {current === "notices" && <Notices />}
        {current === "settings" && <SiteSettings />}
        {current === "audit" && <Audit />}
      </main>
    </div>
  );
}
