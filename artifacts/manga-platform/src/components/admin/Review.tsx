import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, EyeOff, AlertOctagon, ExternalLink, X } from "lucide-react";
import { api } from "@/lib/api";
import { card, timeAgo, Filters, Empty, Pill, useConfirm, Act } from "./shared";

/* ---------------- First chapters from new creators ---------------- */

type Ch = {
  id: number; title: string; chapterNumber: number; pages: string[]; pageCount: number; createdAt: string;
  mangaId: number; mangaTitle: string; mangaSlug: string | null; adminHidden: boolean; creatorId: number; creatorName: string; creatorSlug: string | null;
};

export function FirstChapters() {
  const qc = useQueryClient();
  const { ask, node } = useConfirm();
  const { data } = useQuery({ queryKey: ["admin-chapter-review"], queryFn: () => api<Ch[]>("/admin/chapter-review") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-chapter-review"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); };
  const ok = (id: number) => api(`/admin/chapter-review/${id}`, { body: {} }).then(refresh);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-2xl">The first 2 chapters from every new creator land here. They're already live — check that the art is original. Looks fine? Mark it OK. Copied? Unlist the story and give a strike.</p>
      <ul className="space-y-3">
        {data?.map(c => (
          <li key={c.id} className={`${card} p-4 space-y-3`} data-testid={`review-chapter-${c.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/manga/${c.mangaSlug ?? c.mangaId}/chapter/${c.id}`} className="font-semibold hover:text-primary inline-flex items-center gap-1.5">{c.mangaTitle} — Chapter {c.chapterNumber}: {c.title}<ExternalLink className="w-3.5 h-3.5" /></Link>
              {c.adminHidden && <Pill tone="red">Story unlisted</Pill>}
              <span className="text-xs text-muted-foreground ml-auto">{timeAgo(c.createdAt)}</span>
            </div>
            <p className="text-xs text-muted-foreground">by <Link href={`/creator/${c.creatorSlug ?? c.creatorId}`} className="hover:text-foreground">{c.creatorName}</Link> — {c.pageCount} pages</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {c.pages.map((src, i) => <a key={i} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={`Page ${i + 1}`} className="h-28 w-20 object-cover rounded-md border border-border shrink-0" /></a>)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Act onClick={() => ok(c.id)} testid={`review-ok-${c.id}`}><Check className="w-3.5 h-3.5" />Looks original</Act>
              {!c.adminHidden && <Act danger onClick={() => ask({ title: `Unlist “${c.mangaTitle}”?`, body: "Readers can't see it any more. The creator gets a notice with your reason.", reasonLabel: "Reason (sent to the creator)", confirmLabel: "Unlist story", danger: true, run: async r => { await api(`/admin/stories/${c.mangaId}`, { method: "PATCH", body: { adminHidden: true, adminNote: r } }); await ok(c.id); } })}><EyeOff className="w-3.5 h-3.5" />Unlist story</Act>}
              <Act danger onClick={() => ask({ title: `Strike ${c.creatorName}?`, body: "3 strikes suspends the account.", reasonLabel: "Reason (required)", confirmLabel: "Give strike", danger: true, run: async r => { if (!r.trim()) throw new Error("Write a reason"); await api(`/admin/creators/${c.creatorId}/strike`, { body: { reason: r } }); refresh(); } })}><AlertOctagon className="w-3.5 h-3.5" />Strike creator</Act>
            </div>
          </li>
        ))}
      </ul>
      {data?.length === 0 && <Empty>Nothing to check. New creators' first chapters show up here.</Empty>}
      {node}
    </div>
  );
}

/* ---------------- Ownership transfers ---------------- */

type T = { id: number; creatorId: number; studio: string | null; note: string | null; status: string; createdAt: string; from: { displayName: string; email: string | null } | null; to: { displayName: string; email: string | null } | null };

export function Transfers() {
  const qc = useQueryClient();
  const { ask, node } = useConfirm();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const { data } = useQuery({ queryKey: ["admin-transfers", status], queryFn: () => api<T[]>(`/admin/transfers?status=${status}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-transfers"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); qc.invalidateQueries({ queryKey: ["admin-creators"] }); };
  return (
    <div className="space-y-4">
      <Filters value={status} onChange={setStatus} options={[["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]]} />
      <ul className="space-y-3">
        {data?.map(t => (
          <li key={t.id} className={`${card} p-4 space-y-2`} data-testid={`transfer-${t.id}`}>
            <p className="font-semibold">{t.studio}</p>
            <p className="text-sm">From <b>{t.from?.displayName}</b> <span className="text-muted-foreground">({t.from?.email})</span> to <b>{t.to?.displayName}</b> <span className="text-muted-foreground">({t.to?.email})</span></p>
            {t.note && <p className="text-sm bg-white/[0.03] rounded-lg p-2.5">“{t.note}”</p>}
            <p className="text-xs text-muted-foreground">Asked {timeAgo(t.createdAt)}{t.status !== "pending" ? ` — ${t.status}` : ""}</p>
            {t.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                <Act testid={`approve-transfer-${t.id}`} onClick={() => ask({ title: "Approve the transfer?", body: "The new owner gets full control. The old owner becomes a manager.", confirmLabel: "Approve", run: () => api(`/admin/transfers/${t.id}`, { body: { approve: true } }).then(refresh) })}><Check className="w-3.5 h-3.5" />Approve</Act>
                <Act danger onClick={() => ask({ title: "Reject the transfer?", reasonLabel: "Reason (sent to the owner)", confirmLabel: "Reject", danger: true, run: r => api(`/admin/transfers/${t.id}`, { body: { approve: false, reason: r } }).then(refresh) })}><X className="w-3.5 h-3.5" />Reject</Act>
              </div>
            )}
          </li>
        ))}
      </ul>
      {data?.length === 0 && <Empty>No transfers here.</Empty>}
      {node}
    </div>
  );
}
