import { CheckCircle2, Clock3, TimerOff, XCircle } from "lucide-react";
import type { ApplicationStatus } from "../lib/api";

export const STATUS: Record<ApplicationStatus, { label: string; cls: string; icon: typeof Clock3 }> = {
  pending: { label: "На рассмотрении", cls: "bg-blue-50 text-blue-800 ring-blue-200", icon: Clock3 },
  accepted: { label: "Приглашение", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Отказ", cls: "bg-slate-100 text-slate-600 ring-slate-200", icon: XCircle },
  missed: { label: "Нет ответа 72 ч", cls: "bg-amber-50 text-amber-800 ring-amber-200", icon: TimerOff },
};

export function StatusPill({ status }: { status: ApplicationStatus }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.cls}`}><Icon className="h-3.5 w-3.5" />{s.label}</span>;
}
