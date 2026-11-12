import { useIdentities } from "@/components/StudioTools";
import { useEffect, useRef, useState } from "react";
import { IMAGE_ACCEPT, isImageFile } from "@/lib/image";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, User, Users, Copy, Check, Clock, XCircle, AlertCircle, CheckCircle2, Plus, Trash2, ImagePlus, X, PenTool, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "@/components/ImageUpload";
import { api, uploadFiles, INDIAN_STATES } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Socials = { instagram?: string; x?: string; youtube?: string; website?: string };
type Member = { name: string; email: string; role: string };
type Application = {
  id: number; type: "individual" | "studio"; status: "pending" | "more_info" | "approved" | "rejected"; day: number; reviewDays: number;
  legalName: string; penName: string; email: string; mobile: string; city: string; state: string; portfolioUrl: string | null;
  sampleImages: string[]; socialLinks: Socials; verificationCode: string; codeVerified: boolean;
  studioName: string | null; studioDescription: string | null; studioLogo: string | null; studioBanner: string | null;
  website: string | null; udyamNumber: string | null; gstNumber: string | null; teamMembers: Member[]; reviewNote: string | null; createdAt: string;
};
type Status = {
  verificationCode: string; application: Application | null;
  creator: { id: number; name: string; type: string; status: string; isVerified: boolean; referralCode: string | null } | null;
  teamRole: string | null;
};

const card = "rounded-2xl border border-border bg-card/50 p-6";
const lbl = "text-sm font-medium mb-1.5 block";
const sel = "w-full h-10 rounded-md bg-background border border-input px-3 text-sm";

function CopyBox({ text, big = false }: { text: string; big?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className={`inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 text-primary font-mono ${big ? "text-lg px-4 py-2" : "text-sm px-3 py-1.5"} max-w-full`}>
      <span className="truncate">{text}</span>{ok ? <Check className="w-4 h-4 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
    </button>
  );
}

/** 2–5 sample pages, uploaded one by one. */
function SampleUploader({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function add(files: FileList | null) {
    if (!files) return;
    setBusy(true); setErr("");
    const urls = [...value];
    const picked = Array.from(files);
    if (picked.some(f => !isImageFile(f))) setErr("Only photos can be added as sample pages.");
    for (const f of picked.filter(isImageFile).slice(0, 5 - urls.length)) {
      try { urls.push((await uploadFiles<{ url: string }>("/uploads/image", "file", [f])).url); }
      catch (e) { setErr((e as Error).message); }
    }
    onChange(urls); setBusy(false);
  }
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map(u => (
          <div key={u} className="relative w-24 aspect-[3/4] rounded-lg overflow-hidden border border-border">
            <img src={u} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter(x => x !== u))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center" aria-label="Remove"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {value.length < 5 && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="w-24 aspect-[3/4] rounded-lg border-2 border-dashed border-border hover:border-primary/60 flex flex-col items-center justify-center text-xs text-muted-foreground gap-1">
            {busy ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <><ImagePlus className="w-5 h-5 text-primary" />Add page</>}
          </button>
        )}
      </div>
      <input ref={input} type="file" multiple accept={IMAGE_ACCEPT} className="sr-only" tabIndex={-1} onChange={e => { add(e.target.files); e.target.value = ""; }} />
      {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
    </div>
  );
}

function ApplicationForm({ type, code, initial, inviteToken, onDone, onBack }: {
  type: "individual" | "studio"; code: string; initial?: Application | null; inviteToken?: string; onDone: () => void; onBack?: () => void;
}) {
  const { me } = useAuth();
  const [f, setF] = useState(() => ({
    legalName: initial?.legalName ?? "", penName: initial?.penName ?? "", mobile: initial?.mobile ?? "",
    city: initial?.city ?? "", state: initial?.state ?? "", portfolioUrl: initial?.portfolioUrl ?? "",
    sampleImages: initial?.sampleImages ?? [] as string[], socialLinks: (initial?.socialLinks ?? {}) as Socials,
    studioName: initial?.studioName ?? "", studioDescription: initial?.studioDescription ?? "", studioLogo: initial?.studioLogo ?? "", studioBanner: initial?.studioBanner ?? "",
    website: initial?.website ?? "", udyamNumber: initial?.udyamNumber ?? "", gstNumber: initial?.gstNumber ?? "",
    teamMembers: (initial?.teamMembers ?? []) as Member[], originalWorkAccepted: false,
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const setSocial = (k: keyof Socials, v: string) => set({ socialLinks: { ...f.socialLinks, [k]: v } });
  const studio = type === "studio";

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const body = { ...f, type, inviteToken };
      if (initial) await api("/pro/application", { method: "PATCH", body });
      else await api("/pro/apply", { body });
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {err && <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 px-4 py-3 text-sm">{err}</div>}
      <div className={card}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{studio ? "Studio owner details" : "Your details"}</h3>
          {onBack && <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-primary">Change type</button>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Full legal name *</label><Input required value={f.legalName} onChange={e => set({ legalName: e.target.value })} placeholder="As on your ID (kept private)" /></div>
          <div><label className={lbl}>{studio ? "Your pen name *" : "Pen name / creator name (public) *"}</label><Input required value={f.penName} onChange={e => set({ penName: e.target.value })} /></div>
          <div><label className={lbl}>Email</label><Input value={me?.email ?? ""} disabled /><p className="text-xs text-green-400 mt-1">✓ Verified with your login</p></div>
          <div><label className={lbl}>Mobile number *</label>
            <div className="flex"><span className="h-10 px-3 flex items-center rounded-l-md border border-r-0 border-input text-sm text-muted-foreground">+91</span>
              <Input required inputMode="numeric" maxLength={10} value={f.mobile} onChange={e => set({ mobile: e.target.value.replace(/\D/g, "") })} className="rounded-l-none" /></div>
            <p className="text-xs text-muted-foreground mt-1">Kept private. Only the Surituk team can see it.</p>
          </div>
          <div><label className={lbl}>City *</label><Input required value={f.city} onChange={e => set({ city: e.target.value })} /></div>
          <div><label className={lbl}>State *</label><select required value={f.state} onChange={e => set({ state: e.target.value })} className={sel}><option value="">Select</option>{INDIAN_STATES.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
      </div>

      {studio && (
        <div className={card}>
          <h3 className="text-lg font-bold mb-4">Studio</h3>
          <div className="grid sm:grid-cols-[160px_1fr] gap-5 mb-4">
            <div><label className={lbl}>Logo</label><ImageUpload value={f.studioLogo} onChange={v => set({ studioLogo: v })} aspect="aspect-square" label="Upload logo" /></div>
            <div><label className={lbl}>Banner</label><ImageUpload value={f.studioBanner} onChange={v => set({ studioBanner: v })} aspect="aspect-[16/6]" label="Upload banner" /></div>
          </div>
          <div className="space-y-4">
            <div><label className={lbl}>Studio name *</label><Input required value={f.studioName} onChange={e => set({ studioName: e.target.value })} /></div>
            <div><label className={lbl}>Studio description *</label><Textarea required rows={4} value={f.studioDescription} onChange={e => set({ studioDescription: e.target.value })} placeholder="What does your studio make? Who's in it?" /></div>
            <div><label className={lbl}>Website</label><Input value={f.website} onChange={e => set({ website: e.target.value })} placeholder="https://" /></div>
            <div>
              <label className={lbl}>Team members</label>
              <p className="text-xs text-muted-foreground mb-2">Each person gets an email invite after approval and logs in with their own account.</p>
              <div className="space-y-2">
                {f.teamMembers.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_120px_auto] gap-2">
                    <Input placeholder="Name" value={m.name} onChange={e => set({ teamMembers: f.teamMembers.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                    <Input placeholder="Email" type="email" value={m.email} onChange={e => set({ teamMembers: f.teamMembers.map((x, j) => j === i ? { ...x, email: e.target.value } : x) })} />
                    <select value={m.role} onChange={e => set({ teamMembers: f.teamMembers.map((x, j) => j === i ? { ...x, role: e.target.value } : x) })} className={sel}>
                      <option value="artist">Artist</option><option value="writer">Writer</option><option value="editor">Editor</option>
                    </select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => set({ teamMembers: f.teamMembers.filter((_, j) => j !== i) })} aria-label="Remove member"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => set({ teamMembers: [...f.teamMembers, { name: "", email: "", role: "artist" }] })}><Plus className="w-4 h-4 mr-1" /> Add member</Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div><label className={lbl}>Udyam / MSME number <span className="text-muted-foreground font-normal">(optional)</span></label><Input value={f.udyamNumber} onChange={e => set({ udyamNumber: e.target.value })} placeholder="UDYAM-JH-00-0000000" /></div>
              <div><label className={lbl}>GST number <span className="text-muted-foreground font-normal">(optional)</span></label><Input value={f.gstNumber} onChange={e => set({ gstNumber: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground sm:col-span-2">If verified, your studio gets a "Registered Studio" badge.</p>
            </div>
          </div>
        </div>
      )}

      <div className={card}>
        <h3 className="text-lg font-bold mb-1">Your work</h3>
        <p className="text-sm text-muted-foreground mb-4">Upload 2–5 sample pages <b>or</b> share a portfolio link.</p>
        <SampleUploader value={f.sampleImages} onChange={v => set({ sampleImages: v })} />
        <div className="mt-4"><label className={lbl}>Portfolio link</label><Input value={f.portfolioUrl} onChange={e => set({ portfolioUrl: e.target.value })} placeholder="https://behance.net/… or Google Drive / ArtStation" /></div>
      </div>

      <div className={card}>
        <h3 className="text-lg font-bold mb-1">Social media</h3>
        <p className="text-sm text-muted-foreground mb-4">At least one. To prove the account is yours, put this code in its bio for a few days:</p>
        <CopyBox text={code} big />
        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          <div><label className={lbl}>Instagram</label><Input value={f.socialLinks.instagram ?? ""} onChange={e => setSocial("instagram", e.target.value)} placeholder="https://instagram.com/…" /></div>
          <div><label className={lbl}>X (Twitter)</label><Input value={f.socialLinks.x ?? ""} onChange={e => setSocial("x", e.target.value)} placeholder="https://x.com/…" /></div>
          <div><label className={lbl}>YouTube</label><Input value={f.socialLinks.youtube ?? ""} onChange={e => setSocial("youtube", e.target.value)} placeholder="https://youtube.com/@…" /></div>
          <div><label className={lbl}>Website</label><Input value={f.socialLinks.website ?? ""} onChange={e => setSocial("website", e.target.value)} placeholder="https://" /></div>
        </div>
      </div>

      <label className={`${card} flex items-start gap-3 cursor-pointer`}>
        <Checkbox checked={f.originalWorkAccepted} onCheckedChange={v => set({ originalWorkAccepted: v === true })} className="mt-0.5" />
        <span className="text-sm"><b>This is my original work.</b> I understand that uploading someone else's work (copyright violation) will get my account banned. I accept the <Link href="/terms" className="text-primary underline">Terms of Service</Link>.</span>
      </label>

      <Button type="submit" disabled={busy || !f.originalWorkAccepted} className="w-full h-12 text-base font-semibold">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : initial ? "Resubmit application" : "Submit application"}
      </Button>
    </form>
  );
}

function Referrals() {
  const { data } = useQuery({ queryKey: ["referrals"], queryFn: () => api<{ code: string | null; link: string | null; total: number; active: number }>("/pro/referrals") });
  if (!data?.link) return null;
  return (
    <div className={card}>
      <h3 className="font-bold flex items-center gap-2 mb-1"><Gift className="w-4 h-4 text-accent" /> Invite readers & creators <span className="text-xs font-normal text-muted-foreground">(optional)</span></h3>
      <p className="text-sm text-muted-foreground mb-3">Share your link. Active referrals can earn you a faster Verified badge or a featured slot.</p>
      <CopyBox text={data.link} />
      <p className="text-sm mt-3">{data.total} joined · <b>{data.active}</b> active</p>
    </div>
  );
}

export function ProAccount({ inviteToken }: { inviteToken?: string }) {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const { data: s, isLoading, refetch } = useQuery({ queryKey: ["pro-status"], queryFn: () => api<Status>("/pro/status") });
  const { data: invite } = useQuery({ queryKey: ["invite", inviteToken], queryFn: () => api<{ valid: boolean }>(`/pro/invite/${inviteToken}`), enabled: !!inviteToken });
  const newParam = new URLSearchParams(window.location.search).get("new");
  const [type, setType] = useState<"individual" | "studio" | null>(newParam === "studio" || newParam === "individual" ? newParam : null);
  const { data: ids } = useIdentities();
  const access = ids?.identities.find(i => i.active)?.access;
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (s?.application?.status === "rejected") setType(null); }, [s?.application?.status]);

  async function done() { setType(null); setEditing(false); await refetch(); await refresh(); qc.invalidateQueries(); window.scrollTo({ top: 0 }); }

  if (isLoading || !s) return <Loader2 className="w-6 h-6 animate-spin text-primary" />;
  const app = s.application;
  const c = s.creator;

  const openApp = app && (app.status === "pending" || app.status === "more_info");
  if (c?.status === "approved" && !type) {
    const l = ids?.limits;
    return (
      <div className="space-y-5">
        {openApp && (
          <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
            Your new {app!.type === "studio" ? "studio" : "creator ID"} application is {app!.status === "pending" ? `under review (day ${app!.day} of ${app!.reviewDays})` : "waiting for more information"}.
            {app!.status === "more_info" && <button onClick={() => { setEditing(true); setType(app!.type); }} className="underline ml-1">Update it</button>}
          </div>
        )}
        <div className={`${card} flex flex-col sm:flex-row sm:items-center gap-4 border-green-500/30`}>
          <CheckCircle2 className="w-10 h-10 text-green-400 shrink-0" />
          <div className="flex-1">
            <h3 className="text-lg font-bold">{c.type === "studio" ? "Studio" : "Creator"} account active — {c.name}</h3>
            <p className="text-sm text-muted-foreground">{access ? `Your access: ${access === "editor" ? "can upload & edit" : access}. ` : ""}{c.isVerified ? "✓ Verified — your uploads publish directly." : "Get Verified after 2–3 approved works to publish directly."}</p>
          </div>
          <Button asChild><Link href="/creator-dashboard"><PenTool className="w-4 h-4 mr-2" /> Open Creator Studio</Link></Button>
        </div>
        {ids && (
          <div className={card}>
            <h3 className="font-bold mb-3">Your creator accounts</h3>
            <ul className="space-y-2 mb-4">
              {ids.identities.map(i => (
                <li key={i.id} className="flex items-center gap-3 text-sm">
                  <img src={i.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <span className="flex-1 min-w-0 truncate">{i.name}</span>
                  <span className="text-xs text-muted-foreground">{i.type === "studio" ? "Studio" : "Individual"} — {i.status === "pending" ? "under review" : i.access}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mb-3">One individual creator ID, up to {l?.maxStudios} studios of your own, and membership in up to {l?.maxMemberships} other studios.</p>
            {!openApp && (
              <div className="flex flex-wrap gap-2">
                {l && l.individual === 0 && <Button variant="outline" onClick={() => setType("individual")} data-testid="add-individual"><User className="w-4 h-4 mr-2" />Create individual creator ID</Button>}
                {l && l.studiosOwned < l.maxStudios && <Button variant="outline" onClick={() => setType("studio")} data-testid="add-studio"><Users className="w-4 h-4 mr-2" />Open a studio ({l.studiosOwned}/{l.maxStudios})</Button>}
              </div>
            )}
          </div>
        )}
        <Referrals />
      </div>
    );
  }
  if (c?.status === "suspended" || c?.status === "banned" || c?.status === "revoked") {
    return <div className={`${card} border-red-500/40`}><XCircle className="w-8 h-8 text-red-400 mb-2" /><h3 className="font-bold">{c.status === "revoked" ? "Creator access removed" : `Creator account ${c.status}`}</h3><p className="text-sm text-muted-foreground">Check your notifications for the reason. Contact the <Link href="/grievance" className="text-primary underline">Grievance Officer</Link> if you think this is a mistake.</p></div>;
  }

  if (c?.status !== "approved" && app && (app.status === "pending" || (app.status === "more_info" && !editing))) {
    const pct = Math.round((app.day / app.reviewDays) * 100);
    return (
      <div className="space-y-5">
        <div className={card}>
          {app.status === "pending" ? (
            <>
              <div className="flex items-center gap-3 mb-3"><Clock className="w-6 h-6 text-accent" /><h3 className="text-lg font-bold">Under Review — Day {app.day}/{app.reviewDays}</h3></div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden mb-3"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
              <p className="text-sm text-muted-foreground">We review applications in 3–7 days. You'll get an email and a notification.</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3"><AlertCircle className="w-6 h-6 text-accent" /><h3 className="text-lg font-bold">More information needed</h3></div>
              <p className="text-sm rounded-lg bg-accent/10 border border-accent/30 px-4 py-3 mb-4">{app.reviewNote}</p>
              <Button onClick={() => setEditing(true)}>Update application</Button>
            </>
          )}
        </div>
        <div className={card}>
          <h3 className="font-bold mb-2">Speed up verification</h3>
          <p className="text-sm text-muted-foreground mb-3">Put this code in the bio of {Object.values(app.socialLinks ?? {}).filter(Boolean).length ? "one of your social accounts" : "your social account"}:</p>
          <CopyBox text={app.verificationCode} big />
          <p className="text-sm mt-3">{app.codeVerified ? <span className="text-green-400">✓ Social account verified</span> : <span className="text-muted-foreground">Not checked yet</span>}</p>
        </div>
        <div className={`${card} flex flex-col sm:flex-row gap-4 sm:items-center`}>
          <div className="flex-1"><h3 className="font-bold">Prepare while you wait</h3><p className="text-sm text-muted-foreground">Upload private drafts in Creator Studio. Nobody can see them until you're approved and publish.</p></div>
          <Button asChild variant="outline"><Link href="/creator-dashboard">Open drafts</Link></Button>
        </div>
      </div>
    );
  }

  const chosen = editing && app ? app.type : type;
  return (
    <div className="space-y-5">
      {app?.status === "rejected" && !chosen && (
        <div className={`${card} border-red-500/40`}>
          <div className="flex items-center gap-3 mb-2"><XCircle className="w-6 h-6 text-red-400" /><h3 className="font-bold">Your last application was not approved</h3></div>
          {app.reviewNote && <p className="text-sm text-muted-foreground">Reason: {app.reviewNote}</p>}
          <p className="text-sm mt-2">You can fix this and apply again below.</p>
        </div>
      )}
      {inviteToken && invite?.valid && <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm">🎟️ You were invited by the Surituk team — your account will be <b>approved instantly</b> after you submit.</div>}
      {inviteToken && invite && !invite.valid && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">This invite link has expired or was already used. You can still apply normally.</div>}

      {!chosen ? (
        <>
          <div>
            <h2 className="text-2xl font-bold">Apply for Creator</h2>
            <p className="text-sm text-muted-foreground mt-1">Publish your graphic novels and manga on Surituk. Choose your account type:</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {([["individual", <User className="w-7 h-7 text-primary" />, "Individual Creator", "You write and/or draw your own graphic novels."],
               ["studio", <Users className="w-7 h-7 text-accent" />, "Studio", "A team that publishes together. Invite artists, writers and editors."]] as const).map(([v, icon, title, desc]) => (
              <button key={v} onClick={() => setType(v)} className={`${card} text-left hover:border-primary/60 transition-colors`}>
                {icon}<h3 className="text-lg font-bold mt-3">{title}</h3><p className="text-sm text-muted-foreground mt-1">{desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">We never ask for Aadhaar, PAN, caste, religion or income. Payment details are asked only when you have earnings to withdraw.</p>
        </>
      ) : (
        <ApplicationForm type={chosen} code={s.verificationCode} initial={editing ? app : null} inviteToken={inviteToken} onDone={done} onBack={editing ? undefined : () => setType(null)} />
      )}
    </div>
  );
}
