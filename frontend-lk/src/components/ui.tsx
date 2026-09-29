import { AlertCircle, BadgeCheck, Check, CheckCircle2, ChevronDown, Clock3, Handshake, Lock, Minus, Search, Waypoints, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, type GeoRegion, type MatchItem, type SkillStatus } from "../lib/api";

// ---- toasts --------------------------------------------------------------------------------------

type ToastKind = "success" | "error";
interface ToastAction { label: string; onClick: () => void }
const ToastContext = createContext<(kind: ToastKind, text: string, action?: ToastAction) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; kind: ToastKind; text: string; action?: ToastAction }[]>([]);
  const counter = useRef(0);
  const push = useCallback((kind: ToastKind, text: string, action?: ToastAction) => {
    const id = ++counter.current;
    setToasts((items) => [...items.slice(-2), { id, kind, text, action }]);
    window.setTimeout(() => setToasts((items) => items.filter((t) => t.id !== id)), kind === "error" ? 5000 : action ? 6000 : 3000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-5 right-5 z-[70] flex flex-col gap-2 sm:right-auto sm:w-96" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={`pointer-events-auto flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.kind === "error" ? "bg-rose-600" : "bg-slate-900"}`}>
            {t.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
            <span className="flex-1">{t.text}</span>
            {t.action && <button onClick={() => { t.action!.onClick(); setToasts((items) => items.filter((x) => x.id !== t.id)); }} className="shrink-0 font-bold text-blue-300 hover:text-white">{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---- match index -------------------------------------------------------------------------------

export function scoreTone(score: number) {
  if (score >= 80) return { ring: "#12B76A", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (score >= 50) return { ring: "#1664FF", cls: "bg-blue-50 text-blue-700 ring-blue-200" };
  if (score > 0) return { ring: "#F79009", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
  return { ring: "#98A2B3", cls: "bg-slate-100 text-slate-500 ring-slate-200" };
}

export function ScoreBadge({ score }: { score: number }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset tabular ${scoreTone(score).cls}`}>{Math.round(score)}%</span>;
}

export function MatchRing({ score, verified, size = 56 }: { score: number; verified?: number; size?: number }) {
  const stroke = size > 60 ? 7 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2F6" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#9DBBFF" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
        {verified !== undefined && <circle cx={size / 2} cy={size / 2} r={r} stroke="#12B76A" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(verified / 100) * c} ${c}`} />}
        {verified === undefined && <circle cx={size / 2} cy={size / 2} r={r} stroke={scoreTone(score).ring} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-bold tabular text-slate-800" style={{ fontSize: size * 0.24 }}>{Math.round(score)}%</span>
    </div>
  );
}

const CHIP: Record<MatchItem["status"], { cls: string; icon: ReactNode; hint: string }> = {
  verified: { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: <BadgeCheck className="h-3 w-3" />, hint: "подтверждён вузом" },
  employer: { cls: "bg-violet-50 text-violet-800 ring-violet-200", icon: <Handshake className="h-3 w-3" />, hint: "на усмотрение работодателя" },
  claimed: { cls: "bg-blue-50 text-blue-800 ring-blue-200", icon: <Clock3 className="h-3 w-3" />, hint: "заявлен студентом" },
  related: { cls: "bg-amber-50 text-amber-800 ring-amber-200", icon: <Waypoints className="h-3 w-3" />, hint: "смежный навык" },
  missing: { cls: "bg-white text-slate-400 ring-slate-200", icon: <Minus className="h-3 w-3" />, hint: "нет у кандидата" },
};

export function SkillChip({ item }: { item: MatchItem }) {
  const chip = CHIP[item.status];
  return (
    <span title={`${chip.hint}${item.via ? `: ${item.via}` : ""}${item.is_core ? " · ключевой" : " · желательный"}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${chip.cls}`}>
      {chip.icon}{item.skill}{item.is_core && <span className="h-1 w-1 rounded-full bg-current opacity-60" />}
    </span>
  );
}

export function ChipLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
      {(Object.keys(CHIP) as MatchItem["status"][]).map((s) => <span key={s} className={`inline-flex items-center gap-1 ${s === "missing" ? "" : CHIP[s].cls.split(" ").find((c) => c.startsWith("text-"))}`}>{CHIP[s].icon}<span className="text-slate-500">{CHIP[s].hint}</span></span>)}
    </div>
  );
}

export const SKILL_STATUS: Record<SkillStatus, { label: string; cls: string; icon: ReactNode }> = {
  verified: { label: "Подтверждён", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: <BadgeCheck className="h-3.5 w-3.5" /> },
  employer_review: { label: "На усмотрение работодателя", cls: "bg-violet-50 text-violet-800 ring-violet-200", icon: <Handshake className="h-3.5 w-3.5" /> },
  claimed: { label: "Ждёт проверки", cls: "bg-blue-50 text-blue-800 ring-blue-200", icon: <Clock3 className="h-3.5 w-3.5" /> },
  rejected: { label: "Не подтверждён", cls: "bg-slate-50 text-slate-500 ring-slate-200", icon: <XCircle className="h-3.5 w-3.5" /> },
};

// ---- people ------------------------------------------------------------------------------------

const GRADIENTS = ["from-blue-500 to-violet-600", "from-sky-500 to-blue-700", "from-violet-500 to-fuchsia-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600"];

export function Avatar({ name, size = 40, src }: { name: string; size?: number; src?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) return <img src={src} alt="" onError={() => setBroken(true)} className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />;
  const index = Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % GRADIENTS.length;
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return <span className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GRADIENTS[index]} font-bold text-white`} style={{ width: size, height: size, fontSize: size * 0.36 }}>{letters}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />;
}

export function Empty({ icon, title, text, action, illustration }: { icon: ReactNode; title: string; text: string; action?: ReactNode; illustration?: string }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {illustration ? <img src={illustration} alt="" className="h-40 w-auto" /> : <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">{icon}</span>}
      <p className="mt-4 font-bold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-200 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-blue-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-100" />
      <span><span className="block text-sm font-semibold text-slate-900">{label}</span>{hint && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{hint}</span>}</span>
    </label>
  );
}

// ---- overlays ----------------------------------------------------------------------------------

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">{children}</aside>
    </div>
  );
}

// ---- strict region / city picker ------------------------------------------------------------------

let geoCache: Promise<GeoRegion[]> | null = null;

export function useGeo(): GeoRegion[] {
  const [regions, setRegions] = useState<GeoRegion[]>([]);
  useEffect(() => {
    geoCache = geoCache || api.geo().then((g) => g.regions).catch(() => { geoCache = null; return []; });
    geoCache.then(setRegions);
  }, []);
  return regions;
}

/** Searchable select — the value can only be one of `options` (or empty when `clearable`). */
export function Combobox({ label, value, options, onChange, placeholder, disabled, locked, clearable, compact }: {
  label?: string; value: string; options: string[]; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; locked?: boolean; clearable?: string; compact?: boolean;
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
    return (q ? options.filter((o) => o.toLowerCase().includes(q)) : options).slice(0, 60);
  }, [options, query]);

  const fieldCls = `field ${compact ? "mt-0" : ""} flex items-center justify-between text-left`;
  if (locked) {
    return (
      <div className="label">
        {label}
        <div className={`${fieldCls} bg-slate-50 font-normal text-slate-700`}><span className="truncate">{value || "—"}</span><Lock className="h-4 w-4 shrink-0 text-slate-400" /></div>
      </div>
    );
  }
  return (
    <div className="label relative" ref={box}>
      {label}
      <button type="button" disabled={disabled} onClick={() => { setOpen((v) => !v); setQuery(""); }} aria-haspopup="listbox" aria-expanded={open} className={`${fieldCls} font-normal disabled:bg-slate-50 disabled:text-slate-400`}>
        <span className={`truncate ${value ? "text-slate-900" : "text-slate-400"}`}>{value || placeholder || "Выберите из списка"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 min-w-56 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Начните вводить" className="w-full py-2.5 text-sm font-normal outline-none" />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1 text-sm font-normal" role="listbox">
            {clearable && !query && <li><button type="button" onClick={() => { onChange(""); setOpen(false); }} className="w-full px-3 py-2 text-left text-slate-500 hover:bg-slate-50">{clearable}</button></li>}
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

export function PlacePicker({ region, city, onChange, required, compact, clearable }: { region: string; city: string; onChange: (region: string, city: string) => void; required?: boolean; compact?: boolean; clearable?: boolean }) {
  const regions = useGeo();
  const cities = regions.find((r) => r.region === region)?.cities ?? [];
  return (
    <>
      <Combobox compact={compact} label={compact ? undefined : `Регион${required ? "" : " (необязательно)"}`} value={region} options={regions.map((r) => r.region)} clearable={clearable ? "Любой регион" : undefined} onChange={(v) => onChange(v, "")} placeholder="Регион" />
      <Combobox compact={compact} label={compact ? undefined : "Город"} value={city} options={cities} clearable={clearable ? "Любой город" : undefined} onChange={(v) => onChange(region, v)} disabled={!region} placeholder={region ? "Город" : "Сначала регион"} />
    </>
  );
}

export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false);
}
