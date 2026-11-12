import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Undo2, CalendarClock, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Info = {
  coolingOffDays: number; creatorMinDays: number; accountMinDays: number;
  account: { deletableFrom: string; canDeleteNow: boolean };
  creator: { id: number; name: string; status: string; deletableFrom: string; canDeleteNow: boolean } | null;
  pending: { id: number; kind: "account" | "creator"; reason: string; requestedAt: string; scheduledFor: string }[];
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

function DeleteForm({ kind, info, onDone }: { kind: "account" | "creator"; info: Info; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState("");
  const send = useMutation({
    mutationFn: () => api("/me/deletion", { body: { kind, reason, confirm: confirmText } }),
    onSuccess: () => { setOpen(false); setReason(""); setConfirmText(""); onDone(); },
    onError: (e: Error) => setErr(e.message),
  });
  const isCreator = kind === "creator";

  if (!open) return (
    <Button variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => setOpen(true)} data-testid={`start-delete-${kind}`}>
      <Trash2 className="w-4 h-4 mr-2" />{isCreator ? "Delete creator account" : "Delete my account"}
    </Button>
  );
  return (
    <form onSubmit={e => { e.preventDefault(); setErr(""); send.mutate(); }} className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/[0.04] p-4">
      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
        {isCreator ? <>
          <li>All your stories, chapters and posts will be deleted, and subscribers removed.</li>
          <li>Your reader account stays — you can keep reading and commenting.</li>
        </> : <>
          <li>Your profile, library, reading history, likes, votes and ratings will be erased.</li>
          <li>Your comments stay but show as “Deleted user”.</li>
          {info.creator && <li>Your creator account and all its stories will be deleted too.</li>}
        </>}
        <li>It happens after {info.coolingOffDays} days. You can cancel any time before that.</li>
      </ul>
      <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={1000} placeholder="Why are you leaving? (required)" data-testid={`delete-reason-${kind}`} />
      <div>
        <label className="text-sm block mb-1">Type <b>DELETE</b> to confirm</label>
        <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" data-testid={`delete-confirm-${kind}`} />
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={send.isPending || reason.trim().length < 10 || confirmText.trim().toUpperCase() !== "DELETE"} data-testid={`submit-delete-${kind}`}>
          {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Schedule deletion`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Keep my account</Button>
      </div>
    </form>
  );
}

/** Settings → Account: delete the creator account and/or the whole account, with a cooling-off period. */
export function DeleteAccount() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const { data: info } = useQuery({ queryKey: ["my-deletion"], queryFn: () => api<Info>("/me/deletion") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-deletion"] });
  const cancel = useMutation({ mutationFn: (id: number) => api(`/me/deletion/${id}`, { method: "DELETE" }), onSuccess: refresh });
  if (!info || !me) return <div className="h-40 rounded-2xl bg-card/40 animate-pulse" />;

  const pendingCreator = info.pending.find(p => p.kind === "creator");
  const pendingAccount = info.pending.find(p => p.kind === "account");

  return (
    <div className="space-y-6">
      {info.pending.map(p => (
        <div key={p.id} className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3" data-testid={`pending-deletion-${p.kind}`}>
          <p className="font-semibold flex items-center gap-2"><CalendarClock className="w-5 h-5 text-amber-300" />
            {p.kind === "creator" ? "Your creator account" : "Your account"} will be deleted on {fmt(p.scheduledFor)}
          </p>
          <p className="text-sm text-muted-foreground">Requested on {fmt(p.requestedAt)}. Reason: {p.reason}</p>
          <Button variant="outline" onClick={() => cancel.mutate(p.id)} disabled={cancel.isPending} data-testid={`cancel-deletion-${p.kind}`}><Undo2 className="w-4 h-4 mr-2" />Cancel deletion</Button>
        </div>
      ))}

      {info.creator && !pendingCreator && !pendingAccount && (
        <section className="rounded-2xl border border-border bg-card/50 p-5 space-y-3">
          <h2 className="text-xl">Creator account: {info.creator.name}</h2>
          {info.creator.canDeleteNow || info.creator.status !== "approved" ? (
            <DeleteForm kind="creator" info={info} onDone={refresh} />
          ) : (
            <p className="text-sm text-muted-foreground flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              Creator accounts can be deleted {info.creatorMinDays} days after approval. You can request it from {fmt(info.creator.deletableFrom)}.
              Want to stop for now? You can unpublish your stories from Creator Studio.
            </p>
          )}
        </section>
      )}

      {!pendingAccount && (
        <section className="rounded-2xl border border-border bg-card/50 p-5 space-y-3">
          <h2 className="text-xl">Delete your Surituk account</h2>
          {me.role === "admin"
            ? <p className="text-sm text-muted-foreground">Admin accounts can't be deleted. Ask another admin to remove your admin rights first.</p>
            : info.account.canDeleteNow
              ? <DeleteForm kind="account" info={info} onDone={refresh} />
              : <p className="text-sm text-muted-foreground flex gap-2" data-testid="delete-too-new"><ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  New accounts can be deleted {info.accountMinDays} days after sign-up. You can request it from {fmt(info.account.deletableFrom)}.
                </p>}
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        After deletion we keep only basic sign-up details (name, email) for 180 days, as Indian law requires, and then erase them.
        See our <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
