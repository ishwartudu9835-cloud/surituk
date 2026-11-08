import { useState } from "react";
import { Link } from "wouter";
import { Flag, Loader2, CheckCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type ReportTarget = "manga" | "chapter" | "post" | "comment" | "creator" | "user";

const REASONS: [string, string, string][] = [
  ["copyright", "Copyright", "This is my work (or my client's) and was posted without permission"],
  ["spam", "Spam or scam", "Ads, fake links, repeated junk"],
  ["abuse", "Hate or harassment", "Bullying, threats, hate against a group"],
  ["adult", "Adult content not marked 18+", "Sexual content shown to everyone"],
  ["violence", "Graphic violence", "Gore or real-world violence"],
  ["misleading", "Misleading or fake", "Impersonation, false information"],
  ["other", "Something else", "Tell us what's wrong"],
];

/** A small "Report" link that opens a report form. Copyright reports collect the claimant's details. */
export function ReportButton({ targetType, targetId, label = "Report", className = "", iconOnly = false }: { targetType: ReportTarget; targetId: number; label?: string; className?: string; iconOnly?: boolean }) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [err, setErr] = useState("");

  const send = useMutation({
    mutationFn: () => api("/reports", { method: "POST", body: { targetType, targetId, reason, details, claimantName: name, claimantEmail: email, originalUrl: url, goodFaith } }),
    onError: (e: Error) => setErr(e.message),
  });

  const copyright = reason === "copyright";
  const ready = !!reason && (!copyright || (name.trim() && email.includes("@") && details.trim().length >= 10 && goodFaith));

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { send.reset(); setErr(""); } }}>
      <DialogTrigger asChild>
        <button type="button" className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors ${className}`} aria-label={label} title={label} data-testid={`report-${targetType}-${targetId}`}>
          <Flag className="w-3.5 h-3.5" />{!iconOnly && label}
        </button>
      </DialogTrigger>
      <DialogContent className="bg-background border border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Report</DialogTitle></DialogHeader>
        {!me ? (
          <p className="text-sm text-muted-foreground">Please <Link href={`/login?next=${encodeURIComponent(window.location.pathname)}`} className="text-primary underline">log in</Link> to send a report.</p>
        ) : send.isSuccess ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="font-semibold">Report sent</p>
            <p className="text-sm text-muted-foreground">Our team will review it. You'll get a notification if we take action.</p>
            <Button variant="outline" onClick={() => setOpen(false)} className="mt-2">Close</Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); setErr(""); send.mutate(); }}>
            <div className="space-y-1.5" role="radiogroup">
              {REASONS.map(([v, title, hint]) => (
                <label key={v} className={`flex gap-3 items-start rounded-lg border px-3 py-2 cursor-pointer transition-colors ${reason === v ? "border-primary bg-primary/10" : "border-border hover:border-white/30"}`}>
                  <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} className="mt-1 accent-[var(--brand-red)]" data-testid={`reason-${v}`} />
                  <span><span className="text-sm font-medium block">{title}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
                </label>
              ))}
            </div>
            {copyright && (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-200">Copyright claim — we may share your name and email with the uploader.</p>
                <Input placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} data-testid="input-claimant-name" />
                <Input placeholder="Your email" type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-claimant-email" />
                <Input placeholder="Link to your original work (optional)" value={url} onChange={e => setUrl(e.target.value)} />
              </div>
            )}
            <Textarea placeholder={copyright ? "What was copied, and where is the original? (required)" : "Anything else we should know? (optional)"} rows={3} value={details} onChange={e => setDetails(e.target.value)} maxLength={3000} data-testid="input-report-details" />
            {copyright && (
              <label className="flex gap-2 items-start text-xs text-muted-foreground">
                <input type="checkbox" checked={goodFaith} onChange={e => setGoodFaith(e.target.checked)} className="mt-0.5" data-testid="check-good-faith" />
                I believe in good faith that this use is not authorised by the copyright owner, and the information above is accurate.
              </label>
            )}
            {err && <p className="text-xs text-red-400">{err}</p>}
            <Button type="submit" className="w-full" disabled={!ready || send.isPending} data-testid="button-send-report">
              {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send report"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
