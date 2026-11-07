import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { GenrePicker } from "@/components/GenrePicker";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const SKIP = ["/welcome", "/login", "/terms", "/privacy", "/join/"];

/** Sends newly signed-up users to /welcome once. */
export function OnboardingGate() {
  const { me } = useAuth();
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (me && !me.onboarded && !SKIP.some(p => location.startsWith(p))) {
      navigate(`/welcome?next=${encodeURIComponent(location + window.location.search)}`);
    }
  }, [me, location, navigate]);
  return null;
}

const next = () => {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/welcome") ? n : "/";
};

export default function Onboarding() {
  const { me, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  // Leave only after the fresh profile (onboarded = true) is loaded, so the gate doesn't bounce us back.
  useEffect(() => { if (saved && me?.onboarded) navigate(next()); }, [saved, me?.onboarded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!me || saved) return;
    setName(me.displayName); setUsername(me.username); setIsAdult(me.isAdult); setGenres(me.favoriteGenres); setLang(me.uiLanguage);
  }, [me]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await api("/me/profile", { method: "PATCH", body: { displayName: name, username, isAdult, favoriteGenres: genres, uiLanguage: lang, onboarded: true } });
      await refresh();
      setSaved(true);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  if (!me) return null;
  return (
    <div className="container px-4 py-12 flex justify-center">
      <form onSubmit={save} className="w-full max-w-lg rounded-2xl border border-border bg-card/70 p-7 space-y-6">
        <div>
          <p className="uppercase tracking-[0.3em] text-xs text-primary font-semibold mb-2">Welcome to Surituk</p>
          <h1 className="text-3xl font-bold">Set up your reader profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Takes 30 seconds. You can change it later in Settings.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-medium mb-1.5 block">Display name</label><Input required value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Username</label><Input required value={username} onChange={e => setUsername(e.target.value.toLowerCase())} /></div>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Pick genres you like <span className="text-muted-foreground font-normal">(for "For You" recommendations)</span></label>
          <GenrePicker value={genres} onChange={setGenres} />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Language</label>
          <div className="flex gap-2">
            {([["en", "English"], ["hi", "हिन्दी"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setLang(v)} className={`h-10 px-5 rounded-lg border text-sm ${lang === v ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{l}</button>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-3 p-4 rounded-xl border border-border cursor-pointer">
          <Checkbox checked={isAdult} onCheckedChange={v => setIsAdult(v === true)} className="mt-0.5" />
          <span className="text-sm"><b>I am 18 or older.</b> <span className="text-muted-foreground">Shows series marked 18+ (mature content). Leave unticked to hide them.</span></span>
        </label>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <Button type="submit" disabled={busy} className="w-full h-11 font-semibold">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start reading"}</Button>
      </form>
    </div>
  );
}
