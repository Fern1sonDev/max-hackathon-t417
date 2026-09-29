import { AlertCircle, Check, CheckCircle2, Clock3, Handshake, Info, Loader2, Minus, Waypoints, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { MatchItem } from "../lib/api";
import { bindBackButton } from "../lib/max";

// ---- toasts -------------------------------------------------------------------------

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; text: string }
const ToastContext = createContext<(kind: ToastKind, text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((kind: ToastKind, text: string) => {
    const id = ++counter.current;
    setToasts((items) => [...items.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((items) => items.filter((t) => t.id !== id)), kind === "error" ? 5200 : 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-md flex-col gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={`pointer-events-auto flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg animate-toast-in ${t.kind === "error" ? "bg-rose-600 text-white" : t.kind === "success" ? "bg-slate-900 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200"}`}>
            {t.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : t.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
            <span className="leading-5">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---- bottom sheet ------------------------------------------------------------------------

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const unbind = bindBackButton(onClose);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { unbind(); window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/45 animate-fade-in" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white pb-safe shadow-2xl animate-sheet-up">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-5 pb-2 pt-3 backdrop-blur">
          <span className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
          <button onClick={onClose} aria-label="Закрыть" className="absolute right-3 top-2 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- confirm dialog --------------------------------------------------------------------------

export function Confirm({ open, title, text, confirmLabel, danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; text: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <div className="px-6 pb-6">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <div className="mt-2 text-sm leading-6 text-slate-600">{text}</div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="btn-secondary">Отмена</button>
          <button onClick={onConfirm} disabled={busy} className={danger ? "btn-primary !bg-rose-600 hover:!bg-rose-700 !shadow-none" : "btn-primary"}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ---- match index ring ---------------------------------------------------------------------------

export function scoreTone(score: number) {
  if (score >= 80) return { stroke: "#12B76A", text: "text-emerald-700", bg: "bg-emerald-50", label: "Отлично подходит" };
  if (score >= 50) return { stroke: "#1664FF", text: "text-blue-700", bg: "bg-blue-50", label: "Хорошо подходит" };
  if (score > 0) return { stroke: "#F79009", text: "text-amber-700", bg: "bg-amber-50", label: "Частично подходит" };
  return { stroke: "#98A2B3", text: "text-slate-500", bg: "bg-slate-100", label: "Нет подтверждённых совпадений" };
}

export function MatchRing({ score, potential, size = 60 }: { score: number; potential?: number; size?: number }) {
  const stroke = size >= 80 ? 8 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);
  const pot = Math.max(potential ?? score, score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Индекс соответствия ${score}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2F6" strokeWidth={stroke} fill="none" />
        {pot > score && <circle cx={size / 2} cy={size / 2} r={r} stroke={tone.stroke} strokeOpacity={0.22} strokeWidth={stroke} fill="none" strokeDasharray={`${(pot / 100) * c} ${c}`} strokeLinecap="round" />}
        <circle cx={size / 2} cy={size / 2} r={r} stroke={tone.stroke} strokeWidth={stroke} fill="none" strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .6s cubic-bezier(.16,1,.3,1)" }} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-bold tabular ${tone.text} ${size >= 80 ? "text-xl" : "text-[13px]"}`}>{Math.round(score)}%</span>
    </div>
  );
}

// ---- skill chips ----------------------------------------------------------------------------------

const CHIP: Record<MatchItem["status"], { cls: string; icon: ReactNode; hint: string }> = {
  verified: { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: <Check className="h-3 w-3" />, hint: "подтверждён вузом · ×1" },
  employer: { cls: "bg-violet-50 text-violet-800 ring-violet-200", icon: <Handshake className="h-3 w-3" />, hint: "на усмотрение работодателя · ×0,75" },
  claimed: { cls: "bg-blue-50 text-blue-800 ring-blue-200", icon: <Clock3 className="h-3 w-3" />, hint: "заявлен, ждёт проверки · ×0,5" },
  related: { cls: "bg-amber-50 text-amber-800 ring-amber-200", icon: <Waypoints className="h-3 w-3" />, hint: "смежный навык · ×0,5" },
  missing: { cls: "bg-white text-slate-500 ring-slate-200", icon: <Minus className="h-3 w-3" />, hint: "нет в профиле" },
};

export function SkillChip({ item, compact }: { item: MatchItem; compact?: boolean }) {
  const chip = CHIP[item.status];
  return (
    <span title={`${item.skill}: ${chip.hint}${item.via ? ` (${item.via})` : ""}`} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${chip.cls}`}>
      {chip.icon}
      {item.skill}
      {!compact && item.is_core && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-label="ключевой навык" />}
    </span>
  );
}

export const CHIP_LEGEND = CHIP;

// ---- misc --------------------------------------------------------------------------------------------

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`relative overflow-hidden rounded-xl bg-slate-200/70 ${className}`}><div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" /></div>;
}

export function EmptyState({ icon, title, text, action, illustration }: { icon: ReactNode; title: string; text: string; action?: ReactNode; illustration?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {illustration && !broken
        ? <img src={illustration} alt="" onError={() => setBroken(true)} className="h-40 w-auto drop-shadow-lg" />
        : <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">{icon}</span>}
      <p className="mt-4 font-bold text-slate-900">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm leading-6 text-slate-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="card flex items-start gap-3 border-rose-200 bg-rose-50/60 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-rose-800">{message}</p>
        <button onClick={onRetry} className="mt-2 text-sm font-bold text-rose-700 underline underline-offset-2">Повторить</button>
      </div>
    </div>
  );
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "П";
}

const AVATAR_GRADIENTS = ["from-blue-500 to-violet-600", "from-sky-500 to-blue-700", "from-violet-500 to-fuchsia-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600"];

export function Avatar({ name, size = 44, src }: { name: string; size?: number; src?: string }) {
  const [broken, setBroken] = useState(false);
  const index = Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_GRADIENTS.length;
  if (src && !broken) {
    return <img src={src} alt="" onError={() => setBroken(true)} referrerPolicy="no-referrer" className="shrink-0 rounded-2xl object-cover ring-1 ring-black/5" style={{ width: size, height: size }} />;
  }
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${AVATAR_GRADIENTS[index]} font-bold text-white`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
