import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function TeamInvite() {
  const { token } = useParams<{ token: string }>();
  const { me, loading, refresh } = useAuth();
  const [, navigate] = useLocation();
  const { data, error, isLoading } = useQuery({ queryKey: ["team-invite", token], queryFn: () => api<{ name: string; email: string; role: string; status: string; studio: string; avatar: string }>(`/pro/team-invite/${token}`), retry: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function accept() {
    setBusy(true); setErr("");
    try { await api(`/pro/team-invite/${token}/accept`, { method: "POST" }); await refresh(); navigate("/creator-dashboard"); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="container px-4 py-20 flex justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-8 text-center">
        {isLoading || loading ? <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /> : error || !data ? (
          <p className="text-muted-foreground">{(error as Error)?.message ?? "Invite not found"}</p>
        ) : (
          <>
            {data.avatar ? <img src={data.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4" /> : <Users className="w-12 h-12 text-primary mx-auto mb-4" />}
            <h1 className="text-2xl font-bold">Join {data.studio}</h1>
            <p className="text-muted-foreground mt-2">You've been invited as <b className="text-foreground capitalize">{data.role}</b>.</p>
            <p className="text-xs text-muted-foreground mt-1">Invite for {data.email}</p>
            {!me ? (
              <Button asChild className="w-full mt-6"><Link href={`/login?next=/join/team/${token}`}>Log in with {data.email}</Link></Button>
            ) : (
              <Button onClick={accept} disabled={busy} className="w-full mt-6">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept & join studio"}</Button>
            )}
            {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}
