import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, PauseCircle, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { card, timeAgo, Filters, Empty, Pill, useConfirm, Act } from "./shared";

type Row = {
  id: number; userId: number; kind: "account" | "creator"; creatorId: number | null; reason: string; status: string;
  requestedAt: string; scheduledFor: string; completedAt: string | null; cancelledAt: string | null;
  displayName: string | null; username: string | null; email: string | null; creatorName: string | null;
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function Deletions() {
  const qc = useQueryClient();
  const { ask, node } = useConfirm();
  const [status, setStatus] = useState<"scheduled" | "completed" | "cancelled" | "all">("scheduled");
  const { data } = useQuery({ queryKey: ["admin-deletions", status], queryFn: () => api<Row[]>(`/admin/deletions?status=${status}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-deletions"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-2xl">
        People who asked to delete their account. Deletion runs automatically after the 10-day cooling-off period (accounts can ask 10 days after sign-up; creators can only ask 15 days after approval).
        Put a request on hold if there's an open legal or copyright matter.
      </p>
      <Filters value={status} onChange={setStatus} options={[["scheduled", "Scheduled"], ["completed", "Deleted"], ["cancelled", "Cancelled / on hold"], ["all", "All"]]} />
      <ul className="space-y-3">
        {data?.map(d => (
          <li key={d.id} className={`${card} p-4 space-y-2`} data-testid={`deletion-row-${d.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={d.kind === "creator" ? "amber" : "red"}>{d.kind === "creator" ? "Creator account" : "Whole account"}</Pill>
              {d.status !== "scheduled" && <Pill tone={d.status === "completed" ? "muted" : "green"}>{d.status === "completed" ? "deleted" : "cancelled"}</Pill>}
              <span className="text-xs text-muted-foreground ml-auto">asked {timeAgo(d.requestedAt)}</span>
            </div>
            <p className="font-semibold">{d.kind === "creator" ? d.creatorName : d.displayName} <span className="text-sm font-normal text-muted-foreground">{d.username ? `@${d.username}` : ""} {d.email ?? ""}</span></p>
            <p className="text-sm bg-white/[0.03] rounded-lg p-2.5 break-words">“{d.reason}”</p>
            <p className="text-xs text-muted-foreground">
              {d.status === "scheduled" ? `Will be deleted on ${fmt(d.scheduledFor)}` : d.completedAt ? `Deleted on ${fmt(d.completedAt)}` : d.cancelledAt ? `Cancelled on ${fmt(d.cancelledAt)}` : ""}
            </p>
            {d.status === "scheduled" && (
              <div className="flex flex-wrap gap-2">
                <Act danger testid={`run-deletion-${d.id}`} onClick={() => ask({ title: "Delete now?", body: d.kind === "creator" ? "The creator account, all its stories and posts are deleted right away." : "The account's personal data is erased right away.", confirmLabel: "Delete now", danger: true, run: () => api(`/admin/deletions/${d.id}/run`, { body: {} }).then(refresh) })}><Trash2 className="w-3.5 h-3.5" />Delete now</Act>
                <Act onClick={() => ask({ title: "Put on hold?", body: "The deletion is stopped. The person gets a notice to contact support.", reasonLabel: "Reason (sent to them)", confirmLabel: "Put on hold", run: r => api(`/admin/deletions/${d.id}/cancel`, { body: { reason: r } }).then(refresh) })}><PauseCircle className="w-3.5 h-3.5" />Put on hold</Act>
                <Link href={`/admin/users?id=${d.userId}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs hover:bg-white/5"><ExternalLink className="w-3.5 h-3.5" />Account</Link>
              </div>
            )}
          </li>
        ))}
      </ul>
      {data?.length === 0 && <Empty>No deletion requests here.</Empty>}
      {node}
    </div>
  );
}
