import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadFiles } from "@/lib/api";

/** Single image picker that uploads immediately and returns the URL. */
export function ImageUpload({ value, onChange, label = "Upload cover", aspect = "aspect-[3/4]" }: {
  value: string; onChange: (url: string) => void; label?: string; aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");

  async function pick(file?: File) {
    if (!file) return;
    setErr(""); setPct(0);
    try {
      const { url } = await uploadFiles<{ url: string }>("/uploads/image", "file", [file], setPct);
      onChange(url);
    } catch (e) { setErr((e as Error).message); }
    finally { setPct(null); }
  }

  return (
    <div>
      <div
        onClick={() => input.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
        className={`relative ${aspect} w-full max-w-[220px] rounded-xl border-2 border-dashed border-border hover:border-primary/60 bg-card/40 cursor-pointer overflow-hidden flex items-center justify-center transition-colors`}
      >
        {value ? (
          <>
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <button type="button" onClick={e => { e.stopPropagation(); onChange(""); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center" aria-label="Remove image"><X className="w-4 h-4" /></button>
          </>
        ) : pct !== null ? (
          <div className="text-center text-sm text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />{pct}%</div>
        ) : (
          <div className="text-center text-sm text-muted-foreground px-4"><ImagePlus className="w-7 h-7 mx-auto mb-2 text-primary" />{label}<div className="text-xs mt-1 opacity-70">JPG / PNG / WEBP, max 10 MB</div></div>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
    </div>
  );
}
