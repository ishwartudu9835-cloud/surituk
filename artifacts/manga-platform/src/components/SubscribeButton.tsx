import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetCreatorQueryKey } from "@workspace/api-client-react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type SubState = { subscribed: boolean; subscribers: number; isMe: boolean };

const compact = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

/** Subscribe / Unsubscribe to a creator. Logged-out users are sent to login first. */
export function SubscribeButton({ creatorId, size = "default", showCount = true }: { creatorId: number; size?: "sm" | "default" | "lg"; showCount?: boolean }) {
  const { me } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const key = ["subscription", creatorId, me?.id ?? 0];
  const { data } = useQuery({ queryKey: key, queryFn: () => api<SubState>(`/creators/${creatorId}/subscription`), enabled: creatorId > 0 });
  const [busy, setBusy] = useState(false);

  if (data?.isMe) return null;

  async function toggle() {
    if (!me) { navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    setBusy(true);
    try {
      const r = await api<{ subscribed: boolean; subscribers: number }>(`/creators/${creatorId}/subscribe`, { method: data?.subscribed ? "DELETE" : "POST" });
      qc.setQueryData(key, { ...(data ?? { isMe: false }), ...r });
      qc.invalidateQueries({ queryKey: ["my-subscriptions"] });
      qc.invalidateQueries({ queryKey: getGetCreatorQueryKey(creatorId) });
    } finally { setBusy(false); }
  }

  const subscribed = !!data?.subscribed;
  return (
    <Button onClick={toggle} disabled={busy} size={size} variant={subscribed ? "outline" : "default"}
      className={subscribed ? "border-border" : "bg-primary hover:bg-primary/90 font-semibold"}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : subscribed ? <BellRing className="w-4 h-4 mr-1.5" /> : <Bell className="w-4 h-4 mr-1.5" />}
      {!busy && (subscribed ? "Subscribed" : "Subscribe")}
      {showCount && data && <span className="ml-2 text-xs opacity-75">{compact(data.subscribers)}</span>}
    </Button>
  );
}
