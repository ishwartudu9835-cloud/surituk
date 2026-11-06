import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { api, type Me } from "@/lib/api";
import { useAuth } from "@/lib/auth";

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    } } };
  }
}

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve();
    const existing = document.getElementById("gsi-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const s = document.createElement("script");
    s.id = "gsi-script";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google"));
    document.head.appendChild(s);
  });
}

export const nextPath = () => {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
};

export default function Login() {
  const { me, login } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const googleBtn = useRef<HTMLDivElement>(null);

  const { data: cfg } = useQuery({ queryKey: ["auth-config"], queryFn: () => api<{ googleClientId: string | null }>("/auth/config") });

  useEffect(() => { if (me) navigate(nextPath()); }, [me, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const clientId = cfg?.googleClientId;
    if (!clientId || !googleBtn.current) return;
    let cancelled = false;
    loadGoogleScript().then(() => {
      if (cancelled || !googleBtn.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setBusy(true); setError("");
          try {
            const r = await api<{ token: string; user: Me }>("/auth/google", { body: { credential } });
            await login(r.token);
          } catch (e) { setError((e as Error).message); }
          finally { setBusy(false); }
        },
      });
      window.google.accounts.id.renderButton(googleBtn.current, { theme: "filled_black", size: "large", shape: "pill", text: "continue_with", width: 320 });
    }).catch(() => setError("Google sign-in could not load. Use email instead."));
    return () => { cancelled = true; };
  }, [cfg?.googleClientId, login]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await api<{ ok: true; devCode?: string }>("/auth/otp/request", { body: { email } });
      setDevCode(r.devCode ?? null);
      setStep("code"); setCode(""); setCooldown(60);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function verify(value = code) {
    if (value.length !== 6) return;
    setBusy(true); setError("");
    try {
      const r = await api<{ token: string }>("/auth/otp/verify", { body: { email, code: value } });
      await login(r.token);
    } catch (e) { setError((e as Error).message); setCode(""); }
    finally { setBusy(false); }
  }

  const mark = `${import.meta.env.BASE_URL}surituk-mark.svg`;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 halftone">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/80 backdrop-blur p-7 shadow-2xl">
        <div className="text-center mb-7">
          <img src={mark} alt="" className="w-14 h-14 mx-auto mb-3" />
          <h1 className="text-3xl font-bold">Welcome to Surituk</h1>
          <p className="text-sm text-muted-foreground mt-1">Log in or create an account — it's the same step.</p>
        </div>

        {step === "email" && (
          <>
            {cfg?.googleClientId && (
              <>
                <div className="flex justify-center min-h-[44px]" ref={googleBtn} />
                <div className="flex items-center gap-3 my-5 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" /> or use email <div className="h-px flex-1 bg-border" />
                </div>
              </>
            )}
            <form onSubmit={requestCode} className="space-y-3">
              <Input type="email" required autoFocus placeholder="you@gmail.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
              <Button type="submit" disabled={busy || !email} className="w-full h-11 font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-2" /> Send login code</>}
              </Button>
            </form>
          </>
        )}

        {step === "code" && (
          <div className="space-y-4">
            <button onClick={() => { setStep("email"); setError(""); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Change email</button>
            <p className="text-sm">We sent a 6-digit code to <span className="font-semibold">{email}</span>. Check your inbox (and spam folder).</p>
            {devCode && <p className="text-xs rounded-lg bg-accent/15 text-accent border border-accent/30 px-3 py-2">Dev mode (no email server set up): your code is <b>{devCode}</b></p>}
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={v => { setCode(v); if (v.length === 6) verify(v); }} autoFocus disabled={busy} inputMode="numeric">
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg" />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={() => verify()} disabled={busy || code.length !== 6} className="w-full h-11 font-semibold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & continue"}
            </Button>
            <button disabled={cooldown > 0 || busy} onClick={() => requestCode()} className="w-full text-sm text-muted-foreground hover:text-primary disabled:opacity-50 disabled:hover:text-muted-foreground">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-400 mt-4 text-center">{error}</p>}
        <p className="text-[11px] text-muted-foreground text-center mt-6">By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </div>
    </div>
  );
}
