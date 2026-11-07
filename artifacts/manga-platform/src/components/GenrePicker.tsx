import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { api } from "@/lib/api";

export function GenrePicker({ value, onChange, max = 6 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const { data } = useQuery({ queryKey: ["genre-names"], queryFn: () => api<string[]>("/genres/names") });
  const toggle = (g: string) => onChange(value.includes(g) ? value.filter(x => x !== g) : value.length >= max ? value : [...value, g]);
  return (
    <div className="flex flex-wrap gap-2">
      {data?.map(g => {
        const on = value.includes(g);
        return (
          <button key={g} type="button" onClick={() => toggle(g)}
            className={`h-9 px-3.5 rounded-full border text-sm flex items-center gap-1.5 transition-colors ${on ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-white/5"}`}>
            {on && <Check className="w-3.5 h-3.5" />}{g}
          </button>
        );
      })}
    </div>
  );
}
