import { Briefcase, Building2, CheckCircle2, GraduationCap, MapPin, Send, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { humanError, api, type Profile, type RegionStat, type SkillGapStat, type UniversityAnalytics, type UnmetDemandStat } from "../lib/api";
import BarComparison from "../components/BarComparison";
import ErrorState from "../components/ErrorState";
import StatCard from "../components/StatCard";
import { Skeleton } from "../components/ui";

function UnmetDemand({ items }: { items: UnmetDemandStat[] }) {
  return (
    <div className="card p-5">
      <h2 className="font-bold text-slate-900">Упущенный спрос студентов</h2>
      <p className="mt-1 text-xs text-slate-500">Что студенты ищут фильтром в мини-приложении — и сколько стажировок находится в среднем</p>
      {items.length === 0 ? <p className="mt-4 text-sm text-slate-400">Пока нет данных — студенты ещё не пользовались фильтром.</p> : (
        <div className="mt-4 space-y-2">
          {items.map((u) => (
            <div key={u.skill} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm font-semibold text-slate-900">{u.skill}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">{u.searches} поисков</span>
                <span className={`rounded-full px-2 py-0.5 font-bold ${u.avg_results === 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>в среднем {u.avg_results} стаж.</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UniversityDashboard() {
  const [data, setData] = useState<UniversityAnalytics | null>(null);
  const [error, setError] = useState("");
  function load() {
    setError("");
    api.analyticsUniversity().then(setData).catch((e) => setError(humanError(e, "Не удалось загрузить аналитику")));
  }
  useEffect(load, []);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <div className="grid gap-5 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>;

  const place = [data.city, data.region].filter(Boolean).join(", ");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Студентов на платформе" value={String(data.students)} hint={`${data.groups} групп`} accent />
        <StatCard icon={ShieldCheck} label="Подтверждено навыков" value={String(data.verified_skills)} hint={`ждут проверки: ${data.to_review}`} />
        <StatCard icon={Send} label="Откликов студентов" value={String(data.applications)} />
        <StatCard icon={CheckCircle2} label="Приглашены работодателями" value={String(data.accepted)} hint={data.applications ? `${Math.round((data.accepted / data.applications) * 100)}% откликов` : undefined} />
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-900">Работодатели региона</h2>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{place || "регион не указан в настройках"} · {data.employers_in_region} компаний · {data.vacancies_in_region} активных стажировок</p>
          </div>
        </div>
        {data.employers.length === 0 ? <p className="mt-4 text-sm text-slate-400">В регионе пока нет активных стажировок.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs font-semibold text-slate-500"><tr><th className="py-2 pr-3">Компания</th><th className="px-3 py-2">Город</th><th className="px-3 py-2 text-right">Стажировок</th><th className="px-3 py-2 text-right">Наших откликов</th><th className="px-3 py-2 text-right">Приглашено</th><th className="py-2 pl-3">Ищут навыки</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.employers.map((e) => (
                  <tr key={e.company}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900"><span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" />{e.company}</span></td>
                    <td className="px-3 py-2.5 text-slate-600">{e.city || e.region}</td>
                    <td className="px-3 py-2.5 text-right tabular">{e.vacancies}</td>
                    <td className="px-3 py-2.5 text-right tabular">{e.applications_from_us}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular text-emerald-700">{e.accepted_from_us}</td>
                    <td className="py-2.5 pl-3"><div className="flex flex-wrap gap-1">{e.top_skills.map((s) => <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{s}</span>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-bold text-slate-900">Спрос на навыки и готовность студентов</h2>
          <p className="mt-1 text-xs text-slate-500">Сколько стажировок региона требует навык — и у скольких ваших студентов он подтверждён или заявлен</p>
          {data.skills_demand.length === 0 ? <p className="mt-4 text-sm text-slate-400">Пока нет данных.</p> : (
            <div className="mt-4 space-y-3">
              {data.skills_demand.map((s) => {
                const max = Math.max(1, ...data.skills_demand.map((x) => Math.max(x.vacancies, x.our_verified + x.our_claimed)));
                return (
                  <div key={s.skill}>
                    <div className="flex justify-between text-xs"><span className="font-semibold text-slate-800">{s.skill}</span><span className="text-slate-500">{s.vacancies} стаж. · <span className="text-emerald-700">{s.our_verified} подтв.</span> · <span className="text-blue-700">{s.our_claimed} заявл.</span></span></div>
                    <div className="mt-1 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-l-full bg-emerald-500" style={{ width: `${(s.our_verified / max) * 100}%` }} />
                      <div className="h-full bg-blue-300" style={{ width: `${(s.our_claimed / max) * 100}%` }} />
                    </div>
                    <div className="mt-0.5 h-1 rounded-full bg-slate-800/70" style={{ width: `${(s.vacancies / max) * 100}%` }} title="Спрос" />
                  </div>
                );
              })}
              <p className="flex flex-wrap gap-3 pt-1 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />подтверждено</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-300" />заявлено</span><span className="inline-flex items-center gap-1"><span className="h-1 w-3 rounded-full bg-slate-800/70" />спрос (стажировки)</span></p>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-bold text-slate-900">Группы</h2>
          <p className="mt-1 text-xs text-slate-500">Активность и доля подтверждённых навыков по группам</p>
          {data.by_group.length === 0 ? <p className="mt-4 text-sm text-slate-400">Создайте группы, чтобы видеть срез.</p> : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs font-semibold text-slate-500"><tr><th className="py-2">Группа</th><th className="py-2 text-right">Студ.</th><th className="py-2 text-right">С откликами</th><th className="py-2 text-right">Приглаш.</th><th className="py-2 text-right">Подтв.</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.by_group.map((g) => (
                  <tr key={g.group}><td className="py-2 font-semibold text-slate-900"><span className="inline-flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5 text-slate-400" />{g.group}</span></td><td className="py-2 text-right tabular">{g.students}</td><td className="py-2 text-right tabular">{g.with_applications}</td><td className="py-2 text-right font-semibold tabular text-emerald-700">{g.accepted}</td><td className="py-2 text-right tabular">{Math.round(g.verified_share)}%</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function PlatformAnalytics() {
  const [regions, setRegions] = useState<RegionStat[] | null>(null);
  const [skillsGap, setSkillsGap] = useState<SkillGapStat[] | null>(null);
  const [unmet, setUnmet] = useState<UnmetDemandStat[] | null>(null);
  const [error, setError] = useState("");
  function load() {
    setError("");
    Promise.all([api.analyticsRegions(), api.analyticsSkillsGap(), api.analyticsUnmetDemand()])
      .then(([r, s, u]) => { setRegions(r); setSkillsGap(s); setUnmet(u); })
      .catch((e) => setError(humanError(e, "Не удалось загрузить аналитику")));
  }
  useEffect(load, []);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!regions || !skillsGap || !unmet) return <div className="grid gap-5 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-72" />)}</div>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><MapPin className="h-4 w-4 text-blue-700" />Студенты и стажировки по регионам</h2>
          {regions.length === 0 ? <p className="mt-4 text-sm text-slate-400">Пока нет данных.</p> : <div className="mt-4"><BarComparison legendA="Студенты" legendB="Активные стажировки" rows={regions.map((r) => ({ label: r.region, a: r.students, b: r.vacancies }))} /></div>}
        </div>
        <div className="card p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><Briefcase className="h-4 w-4 text-blue-700" />Разрыв компетенций</h2>
          <p className="mt-1 text-xs text-slate-500">Сколько стажировок требует навык и у скольких студентов он подтверждён вузом</p>
          {skillsGap.length === 0 ? <p className="mt-4 text-sm text-slate-400">Пока нет данных.</p> : <div className="mt-4"><BarComparison legendA="Требуется" legendB="Подтверждено" rows={skillsGap.map((s) => ({ label: s.skill, a: s.required, b: s.verified }))} /></div>}
        </div>
      </div>
      <UnmetDemand items={unmet} />
    </div>
  );
}

export default function Analytics({ profile }: { profile: Profile }) {
  const curator = profile.role === "curator";
  return (
    <div className="page">
      <h1 className="page-title">{curator ? "Аналитика вуза" : "Аналитика рынка"}</h1>
      <p className="page-sub">{curator ? "Кто из работодателей вашего региона ищет стажёров, какие навыки нужны и насколько готовы ваши студенты." : "Где студенты, где стажировки и каких компетенций не хватает — по всей платформе."}</p>
      <div className="mt-6">{curator ? <UniversityDashboard /> : <PlatformAnalytics />}</div>
      {curator && <div className="mt-8"><h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><MapPin className="h-5 w-5 text-blue-700" />Вся платформа</h2><PlatformAnalytics /></div>}
    </div>
  );
}
