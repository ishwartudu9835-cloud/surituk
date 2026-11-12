import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Check, Plus, Building2, User, Loader2, X, LogOut, KeyRound, Crown } from "lucide-react";
import { api, canDo } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { userHref } from "@/lib/links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const card = "rounded-xl border border-border bg-card/40 p-5";

type Identity = { id: number; name: string; type: "individual" | "studio"; status: string; avatar: string; slug: string | null; access: string; role: string; active: boolean };
type Identities = { identities: Identity[]; limits: { individual: number; studiosOwned: number; memberships: number; maxStudios: number; maxMemberships: number } };

export const useIdentities = () => useQuery({ queryKey: ["identities"], queryFn: () => api<Identities>("/pro/identities") });

const ACCESS_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", editor: "Can upload & edit", member: "Member (credit only)" };
const ROLE_TAGS = ["artist", "writer", "editor", "colorist", "letterer", "translator", "other"];

/* ---------------- Account switcher ---------------- */

/** Switch between my individual creator ID and the studios I own or belong to. */
export function AccountSwitcher({ compact = false }: { compact?: boolean }) {
  const { me, refresh } = useAuth();
  const qc = useQueryClient();
  const { data } = useIdentities();
  const [busy, setBusy] = useState(false);
  const current = data?.identities.find(i => i.active);
  async function pick(id: number) {
    if (id === me?.creatorId) return;
    setBusy(true);
    try { await api("/pro/switch", { body: { creatorId: id } }); await refresh(); qc.invalidateQueries(); }
    finally { setBusy(false); }
  }
  const l = data?.limits;
  const canIndividual = l && l.individual === 0;
  const canStudio = l && l.studiosOwned < l.maxStudios;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center gap-2 rounded-lg border border-border bg-card/50 hover:bg-card px-2.5 ${compact ? "h-9" : "h-11"} w-full text-left`} data-testid="account-switcher">
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <img src={current?.avatar ?? me?.creator?.avatar ?? me?.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />}
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium truncate">{current?.name ?? me?.creator?.name}</span>
            {!compact && <span className="block text-[11px] text-muted-foreground truncate">{current ? `${current.type === "studio" ? "Studio" : "Individual"} — ${ACCESS_LABEL[current.access] ?? current.access}` : ""}</span>}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Work as</DropdownMenuLabel>
        {data?.identities.map(i => (
          <DropdownMenuItem key={i.id} onClick={() => pick(i.id)} className="gap-2.5 py-2" data-testid={`identity-${i.id}`}>
            <img src={i.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
            <span className="flex-1 min-w-0">
              <span className="block truncate text-sm">{i.name}</span>
              <span className="block text-[11px] text-muted-foreground">{i.type === "studio" ? "Studio" : "Individual"} — {i.status === "pending" ? "under review" : ACCESS_LABEL[i.access]}</span>
            </span>
            {i.active && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {(canIndividual || canStudio) && <DropdownMenuSeparator />}
        {canIndividual && <DropdownMenuItem asChild><Link href="/settings?tab=pro&new=individual" className="gap-2"><User className="w-4 h-4" />Create individual creator ID</Link></DropdownMenuItem>}
        {canStudio && <DropdownMenuItem asChild><Link href="/settings?tab=pro&new=studio" className="gap-2"><Building2 className="w-4 h-4" />Open a studio ({l!.studiosOwned}/{l!.maxStudios})</Link></DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- Studio team ---------------- */

type Member = { id: number; userId: number | null; name: string; email?: string; role: string; access: string; status: string; isMe: boolean };

export function StudioTeam() {
  const { me, refresh } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["studio-team", me?.creatorId], queryFn: () => api<Member[]>("/pro/team") });
  const { data: transfer } = useQuery({ queryKey: ["studio-transfer", me?.creatorId], queryFn: () => api<{ id: number; toName: string } | null>("/pro/transfer"), enabled: canDo(me, "owner") });
  const [f, setF] = useState({ name: "", email: "", role: "artist", access: "editor" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const isOwner = me?.creator?.access === "owner";
  const isManager = canDo(me, "manager");
  if (me?.creator?.type !== "studio") return <div className={card}>Team members are for studio accounts.</div>;
  const reload = () => { qc.invalidateQueries({ queryKey: ["studio-team"] }); qc.invalidateQueries({ queryKey: ["studio-transfer"] }); };
  const run = async (fn: () => Promise<unknown>, ok?: string) => { setMsg(null); try { await fn(); reload(); if (ok) setMsg({ ok: true, t: ok }); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Studio Team</h1>
      <div className={`${card} text-sm text-muted-foreground space-y-1`}>
        <p><b className="text-foreground">Owner</b> — everything, incl. deleting stories or the studio.</p>
        <p><b className="text-foreground">Manager</b> — upload & edit, delete chapters and pages, change page order, add or remove members, post updates.</p>
        <p><b className="text-foreground">Can upload & edit</b> — create series, upload chapters, edit details.</p>
        <p><b className="text-foreground">Member</b> — credited on the studio page only.</p>
      </div>

      <div className={card}>
        <ul className="divide-y divide-border">
          {data?.map(m => (
            <li key={m.id} className="py-3 flex flex-wrap items-center gap-2" data-testid={`member-${m.id}`}>
              <div className="flex-1 min-w-[10rem]">
                <p className="font-medium flex items-center gap-1.5">{m.access === "owner" && <Crown className="w-4 h-4 text-accent" />}{m.name}{m.isMe && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
              </div>
              {m.status !== "active" && <span className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent">Invited</span>}
              {isManager && m.access !== "owner" && !m.isMe ? (
                <>
                  <select value={m.role} onChange={e => run(() => api(`/pro/team/${m.id}`, { method: "PATCH", body: { role: e.target.value } }))} className="h-8 rounded-md bg-background border border-input px-2 text-xs capitalize" aria-label="Role">
                    {ROLE_TAGS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select value={m.access} onChange={e => run(() => api(`/pro/team/${m.id}`, { method: "PATCH", body: { access: e.target.value } }))} disabled={m.access === "manager" && !isOwner} className="h-8 rounded-md bg-background border border-input px-2 text-xs" aria-label="Access" data-testid={`access-${m.id}`}>
                    {isOwner && <option value="manager">Manager</option>}
                    {!isOwner && m.access === "manager" && <option value="manager">Manager</option>}
                    <option value="editor">Can upload & edit</option>
                    <option value="member">Member</option>
                  </select>
                  {(isOwner || m.access !== "manager") && <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remove ${m.name} from the studio?`)) run(() => api(`/pro/team/${m.id}`, { method: "DELETE" })); }} aria-label="Remove"><X className="w-4 h-4" /></Button>}
                </>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-secondary capitalize">{m.role} — {ACCESS_LABEL[m.access] ?? m.access}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isManager && (
        <form onSubmit={e => { e.preventDefault(); run(() => api("/pro/team", { body: f }).then(() => setF({ name: "", email: "", role: "artist", access: "editor" })), "Invite sent by email"); }} className={`${card} space-y-3`}>
          <h2 className="font-bold">Invite a member</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input required placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
            <Input required type="email" placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
            <select value={f.role} onChange={e => setF({ ...f, role: e.target.value })} className="h-10 rounded-md bg-background border border-input px-3 text-sm capitalize" aria-label="Role">{ROLE_TAGS.map(r => <option key={r} value={r}>{r}</option>)}</select>
            <select value={f.access} onChange={e => setF({ ...f, access: e.target.value })} className="h-10 rounded-md bg-background border border-input px-3 text-sm" aria-label="Access">
              {isOwner && <option value="manager">Manager</option>}
              <option value="editor">Can upload & edit</option>
              <option value="member">Member (credit only)</option>
            </select>
          </div>
          <Button type="submit">Send invite</Button>
        </form>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.t}</p>}

      {isOwner && (
        <div className={`${card} space-y-3`}>
          <h2 className="font-bold flex items-center gap-2"><KeyRound className="w-4 h-4" />Transfer ownership</h2>
          {transfer ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>Waiting for Surituk to approve the transfer to <b>{transfer.toName}</b>.</span>
              <Button variant="outline" size="sm" onClick={() => run(() => api("/pro/transfer", { method: "DELETE" }), "Transfer cancelled")}>Cancel</Button>
            </div>
          ) : (
            <TransferForm members={(data ?? []).filter(m => m.status === "active" && m.access !== "owner" && m.userId)} onDone={() => run(async () => {}, "Transfer requested. An admin will review it.")} />
          )}
        </div>
      )}

      {!isOwner && (
        <Button variant="outline" className="text-red-300 border-red-500/40" onClick={() => { if (confirm("Leave this studio?")) run(async () => { await api("/pro/leave", { body: { creatorId: me?.creatorId } }); await refresh(); }); }}>
          <LogOut className="w-4 h-4 mr-2" />Leave studio
        </Button>
      )}
    </div>
  );
}

function TransferForm({ members, onDone }: { members: Member[]; onDone: () => void }) {
  const [memberId, setMemberId] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  if (!members.length) return <p className="text-sm text-muted-foreground">Add a team member first — ownership can only go to someone already in the studio.</p>;
  return (
    <form onSubmit={async e => { e.preventDefault(); setErr(""); if (!confirm("Hand this studio to them? You'll become a manager once Surituk approves.")) return; try { await api("/pro/transfer", { body: { memberId: Number(memberId), note } }); onDone(); } catch (x) { setErr((x as Error).message); } }} className="space-y-2">
      <p className="text-sm text-muted-foreground">The new owner gets full control. It completes only after a Surituk admin approves it.</p>
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <select required value={memberId} onChange={e => setMemberId(e.target.value)} className="h-10 rounded-md bg-background border border-input px-3 text-sm" aria-label="New owner">
          <option value="">Choose new owner…</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note for the admin (optional)" />
        <Button type="submit" variant="outline">Request transfer</Button>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
    </form>
  );
}

/* ---------------- Followers (studios only) ---------------- */

export function Followers() {
  const { me } = useAuth();
  const studio = me?.creator?.type === "studio";
  const { data, error } = useQuery({ queryKey: ["followers", me?.creatorId], queryFn: () => api<{ name: string; username: string; avatar: string; since: string }[]>("/pro/followers"), enabled: studio && canDo(me, "manager") });
  if (!studio) return <div className={card}>The followers list is a studio feature. <Link href="/settings?tab=pro&new=studio" className="text-primary underline">Open a studio</Link> to get it.</div>;
  if (!canDo(me, "manager")) return <div className={card}>Only the owner and managers can see followers.</div>;
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">Followers</h1>
      <p className="text-sm text-muted-foreground">{data?.length ?? 0} subscriber{data?.length === 1 ? "" : "s"}. Only names are shown — emails stay private.</p>
      {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}
      <ul className={`${card} grid sm:grid-cols-2 gap-x-6 gap-y-3`}>
        {data?.map(f => (
          <li key={f.username}><Link href={userHref(f.username)} className="flex items-center gap-3 hover:text-primary">
            <img src={f.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            <span className="flex-1 min-w-0"><span className="block text-sm truncate">{f.name}</span><span className="block text-xs text-muted-foreground">since {new Date(f.since).toLocaleDateString("en-IN")}</span></span>
          </Link></li>
        ))}
        {data?.length === 0 && <li className="text-sm text-muted-foreground">No subscribers yet.</li>}
      </ul>
    </div>
  );
}

/* ---------------- Page theme (studios only) ---------------- */

export const THEMES = ["#E1191F", "#F4B227", "#2E86AB", "#1B998B", "#6A4C93", "#F25F5C", "#FF8C42", "#3D5A80"];

export function ThemePicker() {
  const { me, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  if (me?.creator?.type !== "studio") return (
    <div className="pt-2 border-t border-border">
      <p className="text-sm font-medium">Page theme</p>
      <p className="text-xs text-muted-foreground">Custom page colours are a studio feature.</p>
    </div>
  );
  const current = me.creator.themeColor;
  async function set(color: string | null) { setBusy(true); try { await api("/creators/me", { body: { themeColor: color } }); await refresh(); } finally { setBusy(false); } }
  return (
    <div className="pt-2 border-t border-border space-y-2">
      <p className="text-sm font-medium">Page theme</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Page theme colour">
        <button type="button" onClick={() => set(null)} disabled={busy} className={`h-9 px-3 rounded-full border text-xs ${!current ? "border-foreground" : "border-border"}`}>Default</button>
        {THEMES.map(c => (
          <button key={c} type="button" onClick={() => set(c)} disabled={busy} aria-label={`Theme ${c}`} data-testid={`theme-${c}`}
            className={`w-9 h-9 rounded-full border-2 ${current === c ? "border-foreground scale-110" : "border-transparent"} transition-transform`} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

export function AddAccountHint() {
  return <Link href="/settings?tab=pro&new=studio" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><Plus className="w-3.5 h-3.5" />Add another creator account</Link>;
}
