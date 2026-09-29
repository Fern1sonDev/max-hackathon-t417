import { ChevronRight, ClipboardList, Loader2, MapPin, Sparkles } from "lucide-react";
import type { Vacancy } from "../lib/api";
import { Avatar, MatchRing, SkillChip } from "./ui";
import { StatusPill } from "./StatusPill";

export default function VacancyCard({ vacancy, busy, onOpen, onApply }: { vacancy: Vacancy; busy: boolean; onOpen: () => void; onApply: () => void }) {
  const match = vacancy.match;
  const score = match?.score ?? 0;
  const gain = match ? Math.round(match.potential - match.score) : 0;
  const pendingNames = match?.items.filter((i) => i.status === "claimed" || i.status === "employer").map((i) => i.skill) ?? [];
  const place = [vacancy.city, vacancy.region].filter(Boolean).join(", ");

  return (
    <article className="card overflow-hidden">
      <button onClick={onOpen} className="block w-full p-4 text-left transition active:bg-slate-50">
        <div className="flex items-start gap-3">
          <Avatar name={vacancy.company_name} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold leading-snug text-slate-900">{vacancy.title}</h3>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-600">{vacancy.company_name}</p>
            {place && <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400"><MapPin className="h-3 w-3 shrink-0" />{place}</p>}
          </div>
          <MatchRing score={score} potential={match?.potential} size={54} />
        </div>

        {match && match.items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {match.items.map((item) => <SkillChip key={item.skill} item={item} />)}
          </div>
        )}

        {gain > 0 && (
          <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            +{gain}% после подтверждения вузом{pendingNames.length ? `: ${pendingNames.slice(0, 3).join(", ")}` : " заявленных навыков"}
          </p>
        )}

        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{vacancy.description}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          {vacancy.has_test_task ? <span className="inline-flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />Короткое задание придёт в чат MAX</span> : <span>Без тестового задания</span>}
          <span className="inline-flex items-center font-semibold text-blue-700">Подробнее<ChevronRight className="h-4 w-4" /></span>
        </div>
      </button>
      <div className="border-t border-slate-100 px-4 py-3">
        {vacancy.my_application_status ? (
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-500">Ваш отклик</span><StatusPill status={vacancy.my_application_status} /></div>
        ) : (
          <button onClick={onApply} disabled={busy} className="btn-primary w-full py-2.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Отправляем отклик…" : "Откликнуться в один тап"}
          </button>
        )}
      </div>
    </article>
  );
}
