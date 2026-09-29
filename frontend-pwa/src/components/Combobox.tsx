import { Check, ChevronDown, Lock, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type GeoRegion } from "../lib/api";

let geoCache: Promise<GeoRegion[]> | null = null;

export function useGeo(): GeoRegion[] {
  const [regions, setRegions] = useState<GeoRegion[]>([]);
  useEffect(() => {
    geoCache = geoCache || api.geo().then((g) => g.regions).catch(() => { geoCache = null; return []; });
    geoCache.then(setRegions);
  }, []);
  return regions;
}

/** Strict searchable select: the value can only be one of `options`. */
export default function Combobox({ label, value, options, onChange, placeholder, disabled, locked }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    return list.slice(0, 50);
  }, [options, query]);

  if (locked) {
    return (
      <div className="label">
        {label}
        <div className="field flex items-center justify-between bg-slate-50 text-slate-700"><span className="truncate">{value || "—"}</span><Lock className="h-4 w-4 shrink-0 text-slate-400" aria-label="Заполнено вузом" /></div>
      </div>
    );
  }

  return (
    <div className="label relative" ref={box}>
      {label}
      <button type="button" disabled={disabled} onClick={() => { setOpen((v) => !v); setQuery(""); }} className="field flex items-center justify-between text-left disabled:bg-slate-50 disabled:text-slate-400">
        <span className={`truncate ${value ? "text-slate-900" : "text-slate-400"}`}>{value || placeholder || "Выберите"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск" className="w-full py-2.5 text-sm font-normal outline-none" />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1 text-sm font-normal" role="listbox">
            {filtered.length === 0 && <li className="px-3 py-2 text-slate-400">Ничего не найдено</li>}
            {filtered.map((o) => (
              <li key={o}>
                <button type="button" role="option" aria-selected={o === value} onClick={() => { onChange(o); setOpen(false); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-slate-800 hover:bg-blue-50">
                  {o}{o === value && <Check className="h-4 w-4 text-blue-700" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
