import { Briefcase, ChevronRight, ClipboardList, MapPin, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, humanError, type Vacancy } from "../lib/api";
import ErrorState from "../components/ErrorState";
import { Empty, Skeleton } from "../components/ui";

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: string | number; tone?: string }) {
  return <div className="min-w-0"><p className={`text-lg font-bold tabular ${tone}`}>{value}</p><p className="truncate text-[11px] text-slate-500">{label}</p></div>;
}

export default function Vacancies() {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<Vacancy[] | null>(null);
  const [error, setError] = useState("");

  function load() {
    setError("");
    api.listMyVacancies().then(setVacancies).catch((e) => setError(humanError(e, "Не удалось загрузить стажировки")));
  }
  useEffect(load, []);

  const totals = (vacancies ?? []).reduce((acc, v) => ({ pending: acc.pending + (v.stats?.pending ?? 0), fresh: acc.fresh + (v.stats?.new_24h ?? 0) }), { pending: 0, fresh: 0 });

  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Стажировки и отклики</h1>
          <p className="page-sub">Откройте стажировку, чтобы работать с её воронкой кандидатов.{vacancies?.length ? ` Сейчас ждут решения: ${totals.pending}, новых за сутки: ${totals.fresh}.` : ""}</p>
        </div>
        <Link to="/vacancies/new" className="btn-primary"><Plus className="h-4 w-4" />Новая стажировка</Link>
      </div>

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}
      {!error && vacancies === null && <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>}
      {!error && vacancies?.length === 0 && (
        <div className="mt-6"><Empty illustration="/illustrations/empty-vacancies.webp" icon={<Briefcase className="h-6 w-6" />} title="Стажировок пока нет" text="Создайте первую по шаблону — это пара минут. Студенты с подходящими навыками получат уведомление в MAX." action={<Link to="/vacancies/new" className="btn-primary"><Plus className="h-4 w-4" />Создать стажировку</Link>} /></div>
      )}

      <div className="mt-6 space-y-3">
        {vacancies?.map((v) => {
          const s = v.stats;
          return (
            <button key={v.vacancy_id} onClick={() => navigate(`/vacancies/${v.vacancy_id}`)} className={`card group grid w-full items-center gap-5 p-5 text-left transition hover:border-blue-300 hover:shadow-lift md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] ${v.is_active ? "" : "opacity-75"}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-bold text-slate-900">{v.title}</h3>
                  {!v.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Скрыта</span>}
                  {(s?.new_24h ?? 0) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white"><Sparkles className="h-3 w-3" />+{s!.new_24h} за сутки</span>}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {(v.region || v.city) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[v.city, v.region].filter(Boolean).join(", ")}</span>}
                  <span className="inline-flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />{v.test_questions.length ? `${v.test_questions.length} вопр.` : "без задания"}</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {v.core_skills.map((sk) => <span key={sk} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">{sk}</span>)}
                  {v.optional_skills.map((sk) => <span key={sk} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{sk}</span>)}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <Stat label="откликов" value={s?.total ?? v.applications_count ?? 0} />
                <Stat label="ждут решения" value={s?.pending ?? 0} tone={(s?.pending ?? 0) ? "text-blue-700" : "text-slate-900"} />
                <Stat label="приглашены" value={s?.accepted ?? 0} tone="text-emerald-700" />
                <Stat label="ср. индекс" value={`${Math.round(s?.avg_match ?? 0)}%`} />
              </div>
              <ChevronRight className="hidden h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600 md:block" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
