import { MapPin, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { humanError, api, type Student } from "../lib/api";
import ErrorState from "../components/ErrorState";
import { Avatar, Empty, PlacePicker, SKILL_STATUS, Skeleton } from "../components/ui";

export default function StudentDirectory() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");

  function load(filters = { q, region, city }) {
    setError("");
    api.studentDirectory(filters).then(setStudents).catch((e) => setError(humanError(e, "Не удалось загрузить список студентов")));
  }
  useEffect(() => load(), []);

  return (
    <div className="page">
      <h1 className="page-title">Каталог студентов</h1>
      <p className="page-sub">Кандидаты по вашим стажировкам и студенты, которые сами открыли профиль в каталоге своего вуза.</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px_220px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Имя или группа" className="field mt-0 pl-9" />
        </div>
        <PlacePicker compact clearable region={region} city={city} onChange={(r, c) => { setRegion(r); setCity(c); load({ q, region: r, city: c }); }} />
        <button onClick={() => load()} className="btn-primary">Найти</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
        {(["verified", "employer_review", "claimed"] as const).map((s) => <span key={s} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${SKILL_STATUS[s].cls}`}>{SKILL_STATUS[s].icon}{s === "claimed" ? "Заявлен студентом" : SKILL_STATUS[s].label}</span>)}
      </div>

      {error && <div className="mt-8"><ErrorState message={error} onRetry={() => load()} /></div>}
      {!error && students === null && <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>}
      {!error && students?.length === 0 && <div className="mt-6"><Empty illustration="/illustrations/empty-search.webp" icon={<Users className="h-6 w-6" />} title="Пока никого не видно" text="Нет откликов по вашим стажировкам, или вузы региона ещё не открыли каталог студентов." /></div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {students?.map((s) => {
          const skills = s.skills.filter((k) => k.status !== "rejected").sort((a, b) => ["verified", "employer_review", "claimed"].indexOf(a.status) - ["verified", "employer_review", "claimed"].indexOf(b.status));
          return (
            <article key={s.user_id} className="card p-5">
              <div className="flex items-start gap-3">
                <Avatar name={s.name} size={44} src={s.avatar_url} />
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-slate-900">{s.name}</h3>
                  <p className="truncate text-xs text-slate-500">{s.university.split(" (")[0]}{s.group ? ` · ${s.group}` : ""}</p>
                  {(s.region || s.city) && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3" />{[s.city, s.region].filter(Boolean).join(", ")}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.length === 0 && <span className="text-xs text-slate-400">Навыки не указаны</span>}
                {skills.map((k) => <span key={k.skill_id} title={k.comment || undefined} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${SKILL_STATUS[k.status].cls}`}>{SKILL_STATUS[k.status].icon}{k.name}</span>)}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
