import type { LucideIcon } from "lucide-react";

export default function StatCard({ icon: Icon, label, value, hint, accent = false }: { icon: LucideIcon; label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-5 ${accent ? "bg-brand text-white shadow-lift" : "card"}`}>
      {accent && <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-xl" />}
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent ? "bg-white/15" : "bg-blue-50"}`}>
        <Icon className={`h-5 w-5 ${accent ? "text-white" : "text-blue-700"}`} strokeWidth={2} />
      </span>
      <div className="mt-5">
        <div className={`text-3xl font-bold tracking-tight tabular ${accent ? "text-white" : "text-slate-900"}`}>{value}</div>
        <div className={`mt-1 text-sm ${accent ? "text-white/85" : "text-slate-500"}`}>{label}</div>
        {hint && <div className={`mt-1.5 text-xs ${accent ? "text-white/70" : "text-slate-400"}`}>{hint}</div>}
      </div>
    </div>
  );
}
