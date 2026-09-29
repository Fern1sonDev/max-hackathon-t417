import { CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, humanError, type Group, type Student } from "../lib/api";
import ErrorState from "../components/ErrorState";
import SkillReview, { SkillSummary } from "../components/SkillReview";
import { Avatar, Combobox, Empty, SKILL_STATUS, Skeleton } from "../components/ui";

export default function Review() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [group, setGroup] = useState("");
  const [onlyQueue, setOnlyQueue] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState<Student | null>(null);

  function load() {
    setError("");
    api.listStudents().then(setStudents).catch((e) => setError(humanError(e, "Не удалось загрузить студентов")));
    api.listGroups().then(setGroups).catch(() => {});
  }
  useEffect(load, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (students ?? [])
      .filter((s) => (!group || s.group === group) && (!q || s.name.toLowerCase().includes(q)) && (!onlyQueue || s.skills.some((k) => k.status === "claimed")))
      .sort((a, b) => b.skills.filter((k) => k.status === "claimed").length - a.skills.filter((k) => k.status === "claimed").length);
  }, [students, group, query, onlyQueue]);

  const queued = (students ?? []).reduce((sum, s) => sum + s.skills.filter((k) => k.status === "claimed").length, 0);

  return (
    <div className="page">
      <h1 className="page-title">Проверка навыков</h1>
      <p className="page-sub">Три решения: подтвердить (с основанием), «на усмотрение работодателя» или отклонить. Сохраняете один раз — студент получает одно сводное уведомление, без спама.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {(["verified", "employer_review", "rejected"] as const).map((s) => (
          <div key={s} className="card flex items-start gap-3 p-4">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${SKILL_STATUS[s].cls}`}>{SKILL_STATUS[s].icon}</span>
            <div className="text-xs leading-5 text-slate-500"><p className="text-sm font-bold text-slate-900">{SKILL_STATUS[s].label}</p>{s === "verified" ? "Зелёный в карточке кандидата, 100% веса в индексе, цифровой сертификат." : s === "employer_review" ? "Вуз не может подтвердить, но и не отрицает — 75% веса, фиолетовый бейдж." : "Навык не учитывается в индексе. Студент видит ваш комментарий."}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по ФИО" className="field mt-0 pl-10" />
        </div>
        <div className="w-56"><Combobox compact value={group} options={groups.map((g) => g.name)} onChange={setGroup} clearable="Все группы" placeholder="Все группы" /></div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600"><input type="checkbox" checked={onlyQueue} onChange={(e) => setOnlyQueue(e.target.checked)} className="h-4 w-4 accent-blue-700" />Только ждущие проверки ({queued})</label>
      </div>

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}
      {!error && students === null && <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
      {!error && students && visible.length === 0 && (
        <div className="mt-6">{onlyQueue && queued === 0
          ? <Empty illustration="/illustrations/success.webp" icon={<CheckCircle2 className="h-6 w-6" />} title="Очередь пуста" text="Все заявленные навыки проверены. Новые заявки появятся здесь, а в MAX придёт напоминание." />
          : <Empty illustration="/illustrations/empty-search.webp" icon={<Search className="h-6 w-6" />} title="Никого не нашли" text="Измените поиск или фильтр по группе." />}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {visible.map((s) => {
          const claimed = s.skills.filter((k) => k.status === "claimed");
          return (
            <article key={s.user_id} className="card flex flex-wrap items-center gap-4 p-4">
              <Avatar name={s.name} size={40} src={s.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">{s.group || "группа не указана"}</p>
              </div>
              <div className="hidden max-w-md flex-wrap gap-1 lg:flex">{claimed.slice(0, 5).map((k) => <span key={k.skill_id} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 ring-1 ring-inset ring-blue-200">{k.name}</span>)}</div>
              <div className="hidden sm:block"><SkillSummary student={s} /></div>
              <button onClick={() => setReviewing(s)} className={claimed.length ? "btn-primary px-3 py-2 text-xs" : "btn-secondary px-3 py-2 text-xs"}><ShieldCheck className="h-3.5 w-3.5" />{claimed.length ? `Проверить (${claimed.length})` : "Открыть"}</button>
            </article>
          );
        })}
      </div>
      {reviewing && <SkillReview student={reviewing} onClose={() => setReviewing(null)} onSaved={(updated) => { setStudents((list) => list && list.map((s) => (s.user_id === updated.user_id ? updated : s))); setReviewing(null); }} />}
    </div>
  );
}
