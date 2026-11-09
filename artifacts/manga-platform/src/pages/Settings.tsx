import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Loader2, User, Briefcase, ShieldAlert } from "lucide-react";
import { DeleteAccount } from "@/components/DeleteAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "@/components/ImageUpload";
import { GenrePicker } from "@/components/GenrePicker";
import { ProAccount } from "@/components/ProAccount";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function ProfileSettings() {
  const { me, refresh } = useAuth();
  const [f, setF] = useState({ displayName: "", username: "", bio: "", avatar: "", isAdult: false, favoriteGenres: [] as string[], uiLanguage: "en" as "en" | "hi" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) setF({ displayName: me.displayName, username: me.username, bio: me.bio ?? "", avatar: me.avatar.startsWith("http") ? me.avatar : "", isAdult: me.isAdult, favoriteGenres: me.favoriteGenres, uiLanguage: me.uiLanguage });
  }, [me]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api("/me/profile", { method: "PATCH", body: { ...f, avatar: f.avatar || undefined } });
      await refresh();
      setMsg({ ok: true, t: "Saved" });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/50 p-6 grid sm:grid-cols-[150px_1fr] gap-6">
        <div><label className="text-sm font-medium mb-1.5 block">Profile photo</label><ImageUpload value={f.avatar} onChange={avatar => setF({ ...f, avatar })} aspect="aspect-square" label="Upload photo" endpoint="/uploads/avatar" rounded="rounded-full" /></div>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-sm font-medium mb-1.5 block">Display name</label><Input value={f.displayName} onChange={e => setF({ ...f, displayName: e.target.value })} /></div>
            <div><label className="text-sm font-medium mb-1.5 block">Username</label><Input value={f.username} onChange={e => setF({ ...f, username: e.target.value.toLowerCase() })} /></div>
          </div>
          <div><label className="text-sm font-medium mb-1.5 block">Email</label><Input value={me?.email ?? ""} disabled /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Bio</label><Textarea rows={2} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} /></div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card/50 p-6 space-y-5">
        <div><label className="text-sm font-medium mb-2 block">Favourite genres</label><GenrePicker value={f.favoriteGenres} onChange={favoriteGenres => setF({ ...f, favoriteGenres })} /></div>
        <div>
          <label className="text-sm font-medium mb-2 block">Language</label>
          <div className="flex gap-2">
            {([["en", "English"], ["hi", "हिन्दी"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setF({ ...f, uiLanguage: v })} className={`h-10 px-5 rounded-lg border text-sm ${f.uiLanguage === v ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{l}</button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Saved to your account. Full Hindi interface is coming soon.</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={f.isAdult} onCheckedChange={v => setF({ ...f, isAdult: v === true })} className="mt-0.5" />
          <span className="text-sm"><b>I am 18 or older</b> — show series marked 18+.</span>
        </label>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.t}</p>}
      <Button type="submit" disabled={busy} className="w-full sm:w-auto px-10">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
    </form>
  );
}

export default function Settings() {
  const { me, loading } = useAuth();
  const params = useParams<{ token?: string }>();
  const inviteToken = params.token;
  const q = new URLSearchParams(window.location.search).get("tab");
  const initial = inviteToken ? "pro" : q === "pro" ? "pro" : q === "account" ? "account" : "profile";
  const [tab, setTab] = useState<"profile" | "pro" | "account">(initial);

  if (loading) return null;
  if (!me) {
    const next = window.location.pathname + window.location.search;
    return <div className="container px-4 py-20 text-center"><Link href={`/login?next=${encodeURIComponent(next)}`} className="text-primary">Log in to open Settings</Link></div>;
  }

  return (
    <div className="container px-4 py-10 max-w-4xl">
      <h1 className="text-4xl font-bold mb-6">Settings</h1>
      <div className="flex gap-1 sm:gap-2 mb-8 border-b border-border overflow-x-auto no-scrollbar">
        {([["profile", "Profile", <User className="w-4 h-4" />], ["pro", "Professional Account", <Briefcase className="w-4 h-4" />], ["account", "Account", <ShieldAlert className="w-4 h-4" />]] as const).map(([v, l, icon]) => (
          <button key={v} onClick={() => setTab(v)} data-testid={`settings-tab-${v}`} className={`shrink-0 pb-3 px-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{icon}{l}</button>
        ))}
      </div>
      {tab === "profile" ? <ProfileSettings /> : tab === "pro" ? <ProAccount inviteToken={inviteToken} /> : <DeleteAccount />}
    </div>
  );
}
