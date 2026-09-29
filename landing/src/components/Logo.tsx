export default function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/logo-mark.svg" alt="ПрактикаПлюс" className="h-9 w-9" />
      <span className={`text-[18px] font-extrabold tracking-tight ${compact ? "hidden sm:inline" : ""} ${light ? "text-white" : "text-slate-900"}`}>
        Практика<span className={light ? "text-blue-300" : "text-blue-700"}>Плюс</span>
      </span>
    </span>
  );
}