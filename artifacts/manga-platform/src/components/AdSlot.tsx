import { useEffect, useRef } from "react";

/**
 * Google AdSense slot.
 * Set VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXX and the slot IDs (VITE_ADSENSE_SLOT_*) at build time.
 * Without a client ID nothing is shown in production; in development a placeholder box shows where the ad will go.
 */
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const SLOTS: Record<string, string | undefined> = {
  banner: import.meta.env.VITE_ADSENSE_SLOT_BANNER,
  inArticle: import.meta.env.VITE_ADSENSE_SLOT_IN_ARTICLE,
  reader: import.meta.env.VITE_ADSENSE_SLOT_READER,
};

let scriptAdded = false;
function ensureScript() {
  if (scriptAdded || !CLIENT) return;
  if (document.querySelector('script[src*="adsbygoogle.js"]')) { scriptAdded = true; return; }
  scriptAdded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

declare global { interface Window { adsbygoogle?: unknown[] } }

export function AdSlot({ kind = "banner", className = "" }: { kind?: "banner" | "inArticle" | "reader"; className?: string }) {
  const ref = useRef<HTMLModElement>(null);
  const slot = SLOTS[kind];

  useEffect(() => {
    if (!CLIENT || !slot || !ref.current || ref.current.dataset.adsbygoogleStatus) return;
    ensureScript();
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by ad blocker */ }
  }, [slot]);

  if (!CLIENT || !slot) {
    if (!import.meta.env.DEV) return null;
    return (
      <div className={`flex items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground h-24 ${className}`}>
        Ad space ({kind}) — set VITE_ADSENSE_CLIENT to show Google ads
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1 text-center">Advertisement</p>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format={kind === "inArticle" ? "fluid" : "auto"}
        data-ad-layout={kind === "inArticle" ? "in-article" : undefined}
        data-full-width-responsive="true"
      />
    </div>
  );
}
