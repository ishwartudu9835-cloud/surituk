import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, ShieldCheck, UserX, Ban, Undo2, Trash2, Megaphone, ExternalLink, AlertOctagon, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { userHref, creatorHref } from "@/lib/links";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { card, timeAgo, Filters, Empty, Pill, useConfirm, Act } from "./shared";

type Row = { id: number; displayName: string; username: string; email: string | null; avatar: string; role: string; creatorId: number | null; onboarded: boolean; blocked: boolean; banned: boolean; joinedAt: string; points: number };
type Detail = {
  id: number; displayName: string; username: string; email: string | null; avatar: string; bio: string | null; role: string; isAdult: boolean; onboarded: boolean;
  blocked: boolean; banned: boolean; banReason: string | null; points: number; joinedAt: string;
  creator: { id: number; name: string; slug: string | null; status: string; strikes: number; isVerified: boolean; totalManga: number; followers: number } | null;
  comments: { id: number; content: string; postId: number; createdAt: string }[];
  reportsAgainst: number; reportsMade: number;
};
type Filter = "all" | "new" | "restricted" | "banned" | "creators" | "admins";

function UserDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const { ask, node } = useConfirm();
  const { data: u } = useQuery({ queryKey: ["admin-user", id], queryFn: () => api<Detail>(`/admin/users/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-user", id] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); };
  const act = (action: string, reason = "") => api(`/admin/users/${id}/action`, { body: { action, reason } }).then(refresh);
  if (!u) return <div className="p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />)}</div>;
  const self = me?.id === u.id;

  return (
    <div className="p-5 space-y-5" data-testid="user-detail">
      <div className="flex items-center gap-3">
        <img src={u.avatar} alt={u.displayName} className="w-14 h-14 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="font-display text-xl font-bold truncate">{u.displayName}</p>
          <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {u.role === "admin" && <Pill tone="blue">Admin</Pill>}
        {u.creator && <Pill tone="green">Creator: {u.creator.status}</Pill>}
        {u.blocked && !u.banned && <Pill tone="amber">Restricted</Pill>}
        {u.banned && <Pill tone="red">Banned</Pill>}
        {!u.onboarded && <Pill>Setup not finished</Pill>}
        {u.isAdult && <Pill>18+ confirmed</Pill>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Email</dt><dd className="break-all">{u.email ?? "—"}</dd>
        <dt className="text-muted-foreground">Joined</dt><dd>{new Date(u.joinedAt).toLocaleString("en-IN")}</dd>
        <dt className="text-muted-foreground">Points</dt><dd>{u.points}</dd>
        <dt className="text-muted-foreground">Reports</dt><dd>{u.reportsAgainst} against them, {u.reportsMade} sent by them</dd>
        {u.banReason && <><dt className="text-muted-foreground">Ban reason</dt><dd>{u.banReason}</dd></>}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link href={userHref(u.username)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs hover:bg-white/5"><ExternalLink className="w-3.5 h-3.5" />Public profile</Link>
        {u.creator && <Link href={creatorHref({ id: u.creator.id, slug: u.creator.slug })} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs hover:bg-white/5"><ExternalLink className="w-3.5 h-3.5" />Creator page</Link>}
      </div>

      {u.creator && (
        <div className={`${card} p-3 text-sm space-y-2`}>
          <p className="font-semibold">{u.creator.name}</p>
          <p className="text-muted-foreground text-xs">{u.creator.totalManga} stories, {u.creator.followers} subscribers, {u.creator.strikes} of 3 strikes</p>
          <Act onClick={() => ask({ title: `Strike ${u.creator!.name}?`, body: "3 strikes suspends the creator account.", reasonLabel: "Reason (required, sent to them)", confirmLabel: "Give strike", danger: true, run: async r => { if (!r.trim()) throw new Error("Write a reason"); await api(`/admin/creators/${u.creator!.id}/strike`, { body: { reason: r } }); refresh(); } })}><AlertOctagon className="w-3.5 h-3.5" />Give strike</Act>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold mb-2">Actions</p>
        <div className="flex flex-wrap gap-2">
          <Act onClick={() => ask({ title: `Send a notice to ${u.displayName}`, reasonLabel: "Message", confirmLabel: "Send", run: async m => { if (m.trim().length < 3) throw new Error("Write a message"); await api("/admin/notices", { body: { target: "user", userId: u.id, message: m } }); } })} testid="act-notice-user"><Megaphone className="w-3.5 h-3.5" />Send notice</Act>
          {!self && !u.blocked && u.role !== "admin" && <Act testid="act-restrict" onClick={() => ask({ title: "Restrict this user?", body: "They can still read, but can't comment, like, vote or rate.", reasonLabel: "Reason (sent to them)", confirmLabel: "Restrict", danger: true, run: r => act("restrict", r) })}><UserX className="w-3.5 h-3.5" />Restrict</Act>}
          {u.blocked && !u.banned && <Act onClick={() => act("unrestrict")}><Undo2 className="w-3.5 h-3.5" />Remove restriction</Act>}
          {!self && !u.banned && u.role !== "admin" && <Act danger testid="act-ban" onClick={() => ask({ title: "Ban this account?", body: "They're logged out and can't log in again.", reasonLabel: "Reason (audit log)", confirmLabel: "Ban", danger: true, run: r => act("ban", r) })}><Ban className="w-3.5 h-3.5" />Ban</Act>}
          {u.banned && <Act onClick={() => act("unban")}><Undo2 className="w-3.5 h-3.5" />Unban</Act>}
          {u.comments.length > 0 && <Act danger onClick={() => ask({ title: "Delete all their comments?", body: `${u.comments.length}+ comments will be removed.`, confirmLabel: "Delete all", danger: true, run: () => act("delete_comments") })}><Trash2 className="w-3.5 h-3.5" />Delete all comments</Act>}
          {u.role !== "admin" && !u.banned && <Act onClick={() => ask({ title: `Make ${u.displayName} an admin?`, body: "They'll get full control of this panel.", confirmLabel: "Make admin", danger: true, run: () => act("make_admin") })}><ShieldCheck className="w-3.5 h-3.5" />Make admin</Act>}
          {u.role === "admin" && !self && <Act danger onClick={() => ask({ title: "Remove admin rights?", confirmLabel: "Remove", danger: true, run: () => act("remove_admin") })}><X className="w-3.5 h-3.5" />Remove admin</Act>}
        </div>
      </div>

      {u.comments.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">Recent comments</p>
          <ul className="space-y-2">
            {u.comments.map(c => <li key={c.id} className="text-sm bg-white/[0.03] rounded-lg p-2.5"><p className="break-words">{c.content}</p><p className="text-xs text-muted-foreground mt-1">{timeAgo(c.createdAt)}</p></li>)}
          </ul>
        </div>
      )}
      <button onClick={onClose} className="sr-only">Close</button>
      {node}
    </div>
  );
}

export function Users() {
  const params = new URLSearchParams(window.location.search);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) ?? "all");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(params.get("id") ? Number(params.get("id")) : null);
  const { data } = useQuery({ queryKey: ["admin-users", query, filter, page], queryFn: () => api<{ total: number; users: Row[] }>(`/admin/users?q=${encodeURIComponent(query)}&filter=${filter}&page=${page}`) });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));

  return (
    <div className="space-y-4">
      <form onSubmit={e => { e.preventDefault(); setQuery(q); setPage(0); }} className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, @username or email" className="pl-9" data-testid="input-user-search" />
      </form>
      <Filters value={filter} onChange={v => { setFilter(v); setPage(0); }} options={[["all", "Everyone"], ["new", "New this week"], ["creators", "Creators"], ["restricted", "Restricted"], ["banned", "Banned"], ["admins", "Admins"]]} />
      <p className="text-xs text-muted-foreground">{data?.total ?? "…"} user{data?.total === 1 ? "" : "s"}</p>
      <ul className={`${card} divide-y divide-border overflow-hidden`}>
        {data?.users.map(u => (
          <li key={u.id}>
            <button onClick={() => setOpenId(u.id)} className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-white/[0.03]" data-testid={`user-row-${u.id}`}>
              <img src={u.avatar} alt={u.displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{u.displayName} <span className="text-muted-foreground font-normal">@{u.username}</span></span>
                <span className="block text-xs text-muted-foreground truncate">{u.email}</span>
              </span>
              <span className="hidden sm:flex gap-1.5">
                {u.role === "admin" && <Pill tone="blue">Admin</Pill>}
                {u.creatorId && <Pill tone="green">Creator</Pill>}
                {u.blocked && !u.banned && <Pill tone="amber">Restricted</Pill>}
                {u.banned && <Pill tone="red">Banned</Pill>}
              </span>
              <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">{timeAgo(u.joinedAt)}</span>
            </button>
          </li>
        ))}
      </ul>
      {data?.users.length === 0 && <Empty>No users match.</Empty>}
      {pages > 1 && (
        <div className="flex items-center gap-3 justify-center">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="w-9 h-9 rounded-md border border-border disabled:opacity-40 flex items-center justify-center" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)} className="w-9 h-9 rounded-md border border-border disabled:opacity-40 flex items-center justify-center" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
      <Sheet open={openId !== null} onOpenChange={o => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0 bg-background">
          <SheetHeader className="sr-only"><SheetTitle>User details</SheetTitle></SheetHeader>
          {openId !== null && <UserDetail id={openId} onClose={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
