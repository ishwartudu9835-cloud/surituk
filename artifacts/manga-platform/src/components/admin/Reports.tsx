import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, EyeOff, Eye, Trash2, Ban, UserX, AlertOctagon, Check, X, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { card, timeAgo, Filters, Empty, Pill, useConfirm, Act } from "./shared";

type Report = {
  id: number; targetType: string; targetId: number; reason: string; details: string | null;
  claimantName: string | null; claimantEmail: string | null; originalUrl: string | null;
  status: string; resolution: string | null; createdAt: string; resolvedAt: string | null;
  reporterId: number | null; reporterName: string | null; reporterEmail: string | null;
  target: { label: string; link: string | null; state: { adminHidden?: boolean; hidden?: boolean; blocked?: boolean; banned?: boolean; creatorId?: number; authorId?: number; mangaId?: number; status?: string; strikes?: number } };
};

const REASON_LABEL: Record<string, string> = { copyright: "Copyright", spam: "Spam", abuse: "Hate / harassment", adult: "Adult content", violence: "Violence", misleading: "Misleading", other: "Other" };
const TYPE_LABEL: Record<string, string> = { manga: "Story", chapter: "Chapter", post: "Post", comment: "Comment", creator: "Creator", user: "User" };

function ReportCard({ r }: { r: Report }) {
  const qc = useQueryClient();
  const { ask, node } = useConfirm();
  const s = r.target.state;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-reports"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); };
  const resolve = (status: "resolved" | "dismissed" | "open", resolution = "") => api(`/admin/reports/${r.id}`, { method: "POST", body: { status, resolution } }).then(refresh);
  const thenResolve = (what: string) => async (reason: string) => { await resolve("resolved", reason ? `${what}: ${reason}` : what); };

  return (
    <article className={`${card} p-4 sm:p-5 space-y-3`} data-testid={`report-card-${r.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={r.reason === "copyright" ? "red" : r.reason === "spam" ? "muted" : "amber"}>{REASON_LABEL[r.reason] ?? r.reason}</Pill>
        <Pill>{TYPE_LABEL[r.targetType] ?? r.targetType}</Pill>
        {r.status !== "open" && <Pill tone={r.status === "resolved" ? "green" : "muted"}>{r.status}</Pill>}
        <span className="text-xs text-muted-foreground ml-auto">{timeAgo(r.createdAt)}</span>
      </div>

      <div>
        {r.target.link
          ? <Link href={r.target.link} className="font-semibold hover:text-primary inline-flex items-center gap-1.5 break-words">{r.target.label}<ExternalLink className="w-3.5 h-3.5 shrink-0" /></Link>
          : <p className="font-semibold text-muted-foreground">{r.target.label}</p>}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {s.adminHidden && <Pill tone="red">Story unlisted</Pill>}
          {s.hidden && <Pill tone="red">Post unlisted</Pill>}
          {s.blocked && <Pill tone="amber">User restricted</Pill>}
          {s.banned && <Pill tone="red">User banned</Pill>}
          {s.status && s.status !== "approved" && <Pill tone="red">Creator {s.status}</Pill>}
          {!!s.strikes && <Pill tone="amber">{s.strikes} strike{s.strikes > 1 ? "s" : ""}</Pill>}
        </div>
      </div>

      {r.reason === "copyright" && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/[0.05] p-3 text-sm space-y-1">
          <p><span className="text-muted-foreground">Claimant:</span> {r.claimantName} — <a href={`mailto:${r.claimantEmail}`} className="text-primary underline break-all">{r.claimantEmail}</a></p>
          {r.originalUrl && <p className="break-all"><span className="text-muted-foreground">Original:</span> <a href={r.originalUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{r.originalUrl}</a></p>}
        </div>
      )}
      {r.details && <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words bg-white/[0.03] rounded-lg p-3">{r.details}</p>}
      <p className="text-xs text-muted-foreground">Reported by {r.reporterName ?? "deleted user"}{r.reporterEmail ? ` (${r.reporterEmail})` : ""}</p>
      {r.resolution && <p className="text-xs text-muted-foreground">Outcome: {r.resolution}</p>}

      {r.status === "open" ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {r.targetType === "manga" && !s.adminHidden && <Act testid="act-unlist-story" onClick={() => ask({ title: "Unlist this story?", body: "Readers won't see it. The creator gets a notice.", reasonLabel: "Reason shown to the creator", confirmLabel: "Unlist", danger: true, run: async reason => { await api(`/admin/stories/${r.targetId}`, { method: "PATCH", body: { adminHidden: true, adminNote: reason } }); await thenResolve("Story unlisted")(reason); } })}><EyeOff className="w-3.5 h-3.5" />Unlist story</Act>}
          {r.targetType === "manga" && <Act danger onClick={() => ask({ title: "Delete this story for good?", body: "All its chapters are deleted. This can't be undone.", confirmLabel: "Delete story", danger: true, run: async () => { await api(`/admin/stories/${r.targetId}`, { method: "DELETE" }); await thenResolve("Story deleted")(""); } })}><Trash2 className="w-3.5 h-3.5" />Delete story</Act>}
          {r.targetType === "chapter" && <Act danger onClick={() => ask({ title: "Delete this chapter?", confirmLabel: "Delete chapter", danger: true, run: async () => { await api(`/admin/chapters/${r.targetId}`, { method: "DELETE" }); await thenResolve("Chapter deleted")(""); } })}><Trash2 className="w-3.5 h-3.5" />Delete chapter</Act>}
          {r.targetType === "post" && !s.hidden && <Act onClick={() => ask({ title: "Unlist this post?", reasonLabel: "Reason shown to the creator", confirmLabel: "Unlist", danger: true, run: async reason => { await api(`/admin/posts/${r.targetId}`, { method: "PATCH", body: { hidden: true, reason } }); await thenResolve("Post unlisted")(reason); } })}><EyeOff className="w-3.5 h-3.5" />Unlist post</Act>}
          {r.targetType === "comment" && <Act danger onClick={() => ask({ title: "Delete this comment?", confirmLabel: "Delete", danger: true, run: async () => { await api(`/community/replies/${r.targetId}`, { method: "DELETE" }); await thenResolve("Comment deleted")(""); } })}><Trash2 className="w-3.5 h-3.5" />Delete comment</Act>}
          {s.creatorId && <Act onClick={() => ask({ title: "Give the creator a strike?", body: "3 strikes suspends their account. They get a notice with your reason.", reasonLabel: "Reason (required)", confirmLabel: "Give strike", danger: true, run: async reason => { if (!reason.trim()) throw new Error("Write a reason"); await api(`/admin/creators/${s.creatorId}/strike`, { body: { reason } }); await thenResolve("Strike given")(reason); } })}><AlertOctagon className="w-3.5 h-3.5" />Strike creator</Act>}
          {s.authorId && !s.blocked && <Act onClick={() => ask({ title: "Restrict this user?", body: "They can't comment, like, vote or rate any more.", reasonLabel: "Reason (sent to them)", confirmLabel: "Restrict", danger: true, run: async reason => { await api(`/admin/users/${s.authorId}/action`, { body: { action: "restrict", reason } }); await thenResolve("User restricted")(reason); } })}><UserX className="w-3.5 h-3.5" />Restrict user</Act>}
          {s.authorId && !s.banned && <Act danger onClick={() => ask({ title: "Ban this account?", body: "They're logged out and can't log in again. A creator account is banned too.", reasonLabel: "Reason (kept in the audit log)", confirmLabel: "Ban", danger: true, run: async reason => { await api(`/admin/users/${s.authorId}/action`, { body: { action: "ban", reason } }); await thenResolve("Account banned")(reason); } })}><Ban className="w-3.5 h-3.5" />Ban account</Act>}
          <Act onClick={() => ask({ title: "Mark as handled?", reasonLabel: "What did you do? (optional)", confirmLabel: "Mark handled", run: reason => resolve("resolved", reason) })}><Check className="w-3.5 h-3.5" />Mark handled</Act>
          <Act onClick={() => ask({ title: "Dismiss this report?", body: "Nothing wrong was found.", reasonLabel: "Note (optional)", confirmLabel: "Dismiss", run: reason => resolve("dismissed", reason) })} testid={`dismiss-${r.id}`}><X className="w-3.5 h-3.5" />Dismiss</Act>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {r.targetType === "manga" && s.adminHidden && <Act onClick={() => api(`/admin/stories/${r.targetId}`, { method: "PATCH", body: { adminHidden: false } }).then(refresh)}><Eye className="w-3.5 h-3.5" />Show story again</Act>}
          {r.targetType === "post" && s.hidden && <Act onClick={() => api(`/admin/posts/${r.targetId}`, { method: "PATCH", body: { hidden: false } }).then(refresh)}><Eye className="w-3.5 h-3.5" />Show post again</Act>}
          <Act onClick={() => resolve("open")}><Undo2 className="w-3.5 h-3.5" />Reopen</Act>
        </div>
      )}
      {node}
    </article>
  );
}

export function Reports() {
  const params = new URLSearchParams(window.location.search);
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed" | "all">("open");
  const [reason, setReason] = useState<string>(params.get("reason") ?? "all");
  const { data, isLoading } = useQuery({ queryKey: ["admin-reports", status, reason], queryFn: () => api<Report[]>(`/admin/reports?status=${status}&reason=${reason}`) });
  return (
    <div className="space-y-4">
      <Filters value={status} onChange={setStatus} options={[["open", "Open"], ["resolved", "Handled"], ["dismissed", "Dismissed"], ["all", "All"]]} />
      <Filters value={reason} onChange={setReason} options={[["all", "Every reason"], ["copyright", "Copyright"], ["spam", "Spam"], ["abuse", "Hate / harassment"], ["adult", "Adult"], ["violence", "Violence"], ["misleading", "Misleading"], ["other", "Other"]]} />
      {isLoading && <div className={`${card} h-40 animate-pulse`} />}
      <div className="space-y-3">{data?.map(r => <ReportCard key={r.id} r={r} />)}</div>
      {data?.length === 0 && <Empty>{status === "open" ? "No open reports. Nice." : "Nothing here."}</Empty>}
    </div>
  );
}
