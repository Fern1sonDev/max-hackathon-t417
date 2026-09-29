import { ArrowRight, BadgeCheck, Briefcase, CheckCircle2, Clock3, GraduationCap, Percent, ShieldCheck, TimerOff, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, humanError, type Application, type Funnel, type Group, type Profile, type UniversityAnalytics, type Vacancy } from "../lib/api";
import StatCard from "../components/StatCard";
import ErrorState from "../components/ErrorState";
import { Avatar, ScoreBadge, Skeleton } from "../components/ui";

function FunnelBar({ funnel }: { funnel: Funnel }) {
  const steps = [
    { label: "Откликов", value: funnel.applications, cls: "bg-blue-600" },
    { label: "Ответили на задание", value: funnel.answered, cls: "bg-violet-600" },
    { label: "Приглашены", value: funnel.accepted, cls: "bg-emerald-500" },
  ];
  const max = Math.max(1, funnel.applications);
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">Воронка</h2>
        {funnel.median_hours_to_decision !== null && <span className="text-xs text-slate-500">медиана до решения: <b className="text-slate-800">{funnel.median_hours_to_decision} ч</b></span>}
      </div>
      <div className="mt-5 space-y-3">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-sm"><span className="text-slate-600">{s.label}</span><span className="font-bold tabular text-slate-900">{s.value}</span></div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${s.cls}`} style={{ width: `${(s.value / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><TimerOff className="h-3.5 w-3.5 text-amber-600" />Без решения 72 ч: <b className="text-slate-700">{funnel.missed}</b> · отказ: <b className="text-slate-700">{funnel.rejected}</b></p>
    </div>
  );
}

function HrOverview() {
  const [data, setData] = useState<{ vacancies: Vacancy[]; apps: Application[]; funnel: Funnel } | null>(null);
  const [error, setError] = useState("");
  function load() {
    setError("");
    Promise.all([api.listMyVacancies(), api.listApplications(), api.analyticsFunnel()])
      .then(([vacancies, apps, funnel]) => setData({ vacancies, apps, funnel }))
      .catch((e) => setError(humanError(e, "Не удалось загрузить сводку")));
  }
  useEffect(load, []);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <div className="grid gap-5 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>;

  const pending = data.apps.filter((a) => a.status === "pending");
  const overdue = pending.filter((a) => a.is_overdue).length;
  const top = pending.slice().sort((a, b) => b.match_score - a.match_score).slice(0, 6);
  const active = data.vacancies.filter((v) => v.is_active);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Percent} label="Средний индекс кандидатов" value={`${Math.round(data.funnel.avg_match)}%`} hint="по всем навыкам с учётом доверия" accent />
        <StatCard icon={Briefcase} label="Активные стажировки" value={String(active.length)} />
        <StatCard icon={Clock3} label="Ждут решения" value={String(pending.length)} hint={overdue ? `${overdue} дольше 48 ч` : "нет просроченных"} />
        <StatCard icon={CheckCircle2} label="Приглашены" value={String(data.funnel.accepted)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Лучшие кандидаты на рассмотрении</h2>
            <Link to="/vacancies" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">Все стажировки<ArrowRight className="h-4 w-4" /></Link>
          </div>
          {top.length === 0 ? <p className="mt-6 text-sm text-slate-400">Новых откликов пока нет.</p> : (
            <ul className="mt-4 divide-y divide-slate-100">
              {top.map((a) => (
                <li key={a.app_id}>
                  <Link to={`/vacancies/${a.vacancy_id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50">
                    <Avatar name={a.student_name} size={36} src={a.student_avatar_url} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{a.student_name}</p><p className="truncate text-xs text-slate-500">{a.vacancy_title}{a.student_university ? ` · ${a.student_university.split(" (")[0]}` : ""}</p></div>
                    {a.skills_verified && <BadgeCheck className="h-4 w-4 text-emerald-600" aria-label="Все навыки подтверждены вузом" />}
                    <ScoreBadge score={a.match_score} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FunnelBar funnel={data.funnel} />
      </div>
      {active.length > 0 && (
        <div className="card p-6">
          <h2 className="font-bold text-slate-900">Стажировки</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {active.map((v) => (
              <Link key={v.vacancy_id} to={`/vacancies/${v.vacancy_id}`} className="rounded-2xl border border-slate-200/80 p-4 transition hover:border-blue-300 hover:bg-blue-50/30">
                <p className="truncate font-semibold text-slate-900">{v.title}</p>
                <p className="mt-1 text-xs text-slate-500">{v.stats?.total ?? 0} откликов · <span className="font-semibold text-blue-700">{v.stats?.pending ?? 0} ждут</span> · {v.stats?.accepted ?? 0} приглаш.</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CuratorOverview() {
  const [data, setData] = useState<{ stats: UniversityAnalytics; groups: Group[] } | null>(null);
  const [error, setError] = useState("");
  function load() {
    setError("");
    Promise.all([api.analyticsUniversity(), api.listGroups()])
      .then(([stats, groups]) => setData({ stats, groups }))
      .catch((e) => setError(humanError(e, "Не удалось загрузить сводку")));
  }
  useEffect(load, []);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <div className="grid gap-5 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>;
  const { stats, groups } = data;
  const queue = groups.filter((g) => g.to_review > 0).sort((a, b) => b.to_review - a.to_review);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Ждут проверки" value={String(stats.to_review)} hint="навыков заявлено студентами" accent />
        <StatCard icon={GraduationCap} label="Студентов на платформе" value={String(stats.students)} hint={`${stats.groups} групп`} />
        <StatCard icon={Briefcase} label="Стажировок в регионе" value={String(stats.vacancies_in_region)} hint={`${stats.employers_in_region} работодателей`} />
        <StatCard icon={CheckCircle2} label="Приглашены работодателями" value={String(stats.accepted)} hint={`из ${stats.applications} откликов`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Очередь проверки по группам</h2>
            <Link to="/review" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">Проверить<ArrowRight className="h-4 w-4" /></Link>
          </div>
          {queue.length === 0 ? <p className="mt-6 text-sm text-slate-400">Все заявленные навыки проверены.</p> : (
            <ul className="mt-4 divide-y divide-slate-100">
              {queue.map((g) => (
                <li key={g.group_id}>
                  <Link to={`/groups/${g.group_id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UsersRound className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{g.name}</p><p className="text-xs text-slate-500">{g.students_count} студентов · куратор {g.curator_name || "—"}</p></div>
                    <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">{g.to_review}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Кого ищут работодатели</h2>
            <Link to="/analytics" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">Аналитика<ArrowRight className="h-4 w-4" /></Link>
          </div>
          <ul className="mt-4 space-y-2.5">
            {stats.skills_demand.slice(0, 6).map((s) => (
              <li key={s.skill} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-semibold text-slate-800">{s.skill}</span>
                <span className="shrink-0 text-xs text-slate-500">{s.vacancies} стаж. · <span className="font-semibold text-emerald-700">{s.our_verified} подтв.</span></span>
              </li>
            ))}
            {stats.skills_demand.length === 0 && <li className="text-sm text-slate-400">Нет данных о спросе.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Overview({ profile }: { profile: Profile }) {
  const first = profile.role === "hr" && profile.is_owner ? "" : profile.name.split(" ")[0];
  return (
    <div className="page">
      <h1 className="page-title">Добрый день{first ? `, ${first}` : ""}!</h1>
      <p className="page-sub">{profile.role === "hr" ? "Отклики, решения и воронка по вашим стажировкам" : "Проверка навыков по группам и спрос работодателей региона"}</p>
      <div className="mt-7">{profile.role === "hr" ? <HrOverview /> : <CuratorOverview />}</div>
    </div>
  );
}
