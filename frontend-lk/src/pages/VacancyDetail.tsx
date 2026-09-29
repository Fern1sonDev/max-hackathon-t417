import { AlarmClock, ArrowLeft, BadgeCheck, ClipboardList, Download, EyeOff, Loader2, MapPin, MessageSquareReply, Pencil, RotateCw, Send, Undo2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, exportApplicationsCsv, humanError, type Application, type NextStep, type Profile, type Vacancy } from "../lib/api";
import ErrorState from "../components/ErrorState";
import { CandidatePanel, FORMAT_LABEL, NextStepModal, RejectModal, mmss, useSecondsLeft } from "../components/Candidate";
import { Avatar, Empty, ScoreBadge, SkillChip, Skeleton, useToast } from "../components/ui";

type Column = { key: string; title: string; dot: string; hint?: string; test: (a: Application) => boolean; drop?: "pending" | "accepted" | "rejected" };

function columns(hasQuestions: boolean): Column[] {
  const answered = (a: Application) => Boolean(a.test_answer || a.test_answers.length);
  return [
    { key: "new", title: hasQuestions ? "Новые · ждём ответ" : "Новые отклики", dot: "bg-blue-600", test: (a) => a.status === "pending" && (!hasQuestions || !answered(a)), drop: "pending" },
    ...(hasQuestions ? [{ key: "answered", title: "Ответили на задание", dot: "bg-violet-600", test: (a: Application) => a.status === "pending" && answered(a), drop: "pending" as const }] : []),
    { key: "accepted", title: "Приглашены", dot: "bg-emerald-500", test: (a) => a.status === "accepted", drop: "accepted" },
    { key: "rejected", title: "Отказ", dot: "bg-slate-400", test: (a) => a.status === "rejected", drop: "rejected" },
    { key: "missed", title: "Без решения 72 ч", dot: "bg-amber-500", hint: "Автоматически: студент уже получил альтернативы в MAX", test: (a) => a.status === "missed" },
  ];
}

function PendingBadge({ app, onUndo }: { app: Application; onUndo: () => void }) {
  const left = useSecondsLeft(app.pending_decision_until);
  if (!left) return null;
  return (
    <span className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white">
      <span className="whitespace-nowrap tabular">Уйдёт через {mmss(left)}</span>
      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onUndo(); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onUndo(); } }} className="inline-flex items-center gap-1 text-blue-300 hover:text-white"><Undo2 className="h-3 w-3" />Отменить</span>
    </span>
  );
}

function CandidateCard({ app, hasQuestions, onOpen, onUndo }: { app: Application; hasQuestions: boolean; onOpen: () => void; onUndo: () => void }) {
  const answered = Boolean(app.test_answer || app.test_answers.length);
  return (
    <button draggable onDragStart={(e) => e.dataTransfer.setData("text/app-id", String(app.app_id))} onClick={onOpen} className="block w-full cursor-grab rounded-xl border border-slate-200/70 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <Avatar name={app.student_name} size={34} src={app.student_avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{app.student_name}</p>
          <p className="truncate text-xs text-slate-500">{[app.student_university.split(" (")[0], app.student_group].filter(Boolean).join(" · ")}</p>
        </div>
        <ScoreBadge score={app.match_score} />
      </div>
      {app.match && <div className="mt-2 flex flex-wrap gap-1">{app.match.items.slice(0, 5).map((i) => <SkillChip key={i.skill} item={i} />)}</div>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {app.skills_verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><BadgeCheck className="h-3 w-3" />Всё подтверждено вузом</span>}
        {hasQuestions && app.status === "pending" && answered && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700"><MessageSquareReply className="h-3 w-3" />Есть ответ</span>}
        {app.status === "accepted" && app.next_step && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{FORMAT_LABEL[app.next_step.format]}{app.next_step.datetime ? ` · ${app.next_step.datetime}` : ""}</span>}
        {app.status === "pending" && app.is_overdue && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700"><AlarmClock className="h-3 w-3" />Дольше 48 ч</span>}
      </div>
      <PendingBadge app={app} onUndo={onUndo} />
    </button>
  );
}

export default function VacancyDetail({ profile }: { profile: Profile }) {
  const { id } = useParams();
  const vacancyId = Number(id);
  const toast = useToast();
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [modal, setModal] = useState<{ kind: "invite" | "reject"; app: Application } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setError("");
    Promise.all([api.getVacancy(vacancyId), api.vacancyPipeline(vacancyId)])
      .then(([v, list]) => { setVacancy(v); setApps(list); })
      .catch((e) => setError(humanError(e, "Не удалось загрузить стажировку")));
  }, [vacancyId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && api.vacancyPipeline(vacancyId).then(setApps).catch(() => {}), 20000);
    return () => window.clearInterval(timer);
  }, [load, vacancyId]);

  const refreshStats = () => api.getVacancy(vacancyId).then(setVacancy).catch(() => {});
  const replace = (updated: Application) => setApps((list) => list && list.map((a) => (a.app_id === updated.app_id ? updated : a)));

  async function decide(app: Application, status: "pending" | "accepted" | "rejected", extra: { message?: string; next_step?: NextStep } = {}) {
    try {
      const updated = await api.decide(app.app_id, status, extra);
      replace(updated);
      setModal(null);
      refreshStats();
      if (status === "pending") toast("success", "Отклик возвращён на рассмотрение");
      else toast("success", `${app.student_name}: ${status === "accepted" ? "приглашение" : "отказ"} уйдёт через 90 с`, { label: "Отменить", onClick: () => undo(updated) });
    } catch (e) {
      toast("error", humanError(e, "Не удалось сохранить решение"));
    }
  }

  async function undo(app: Application) {
    try {
      replace(await api.undoDecision(app.app_id));
      refreshStats();
      toast("success", "Решение отменено — студент ничего не получил");
    } catch (e) {
      toast("error", humanError(e, "Не удалось отменить"));
      load();
    }
  }

  function dropTo(appId: number, col: Column) {
    const app = apps?.find((a) => a.app_id === appId);
    if (!app || !col.drop) {
      if (!col.drop) toast("error", "Эта колонка заполняется автоматически");
      return;
    }
    if (col.drop === "accepted" && app.status !== "accepted") setModal({ kind: "invite", app });
    else if (col.drop === "rejected" && app.status !== "rejected") setModal({ kind: "reject", app });
    else if (col.drop === "pending" && app.status !== "pending") decide(app, "pending");
  }

  async function toggleActive() {
    if (!vacancy) return;
    try {
      setVacancy(await api.toggleVacancyActive(vacancy.vacancy_id, !vacancy.is_active));
      toast("success", vacancy.is_active ? "Стажировка скрыта из ленты" : "Стажировка опубликована");
    } catch (e) {
      toast("error", humanError(e, "Не удалось изменить видимость"));
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const url = URL.createObjectURL(await exportApplicationsCsv());
      const a = document.createElement("a");
      a.href = url;
      a.download = "otkliki.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("error", "Не удалось выгрузить отклики");
    } finally { setExporting(false); }
  }

  if (error) return <div className="page"><ErrorState message={error} onRetry={load} /></div>;
  if (!vacancy || !apps) return <div className="page space-y-4"><Skeleton className="h-36" /><div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div></div>;

  const hasQuestions = vacancy.test_questions.length > 0;
  // The automatic "no decision in 72 h" column appears only when it has cards.
  const cols = columns(hasQuestions).filter((c) => c.key !== "missed" || apps.some(c.test));
  const gridCols: Record<number, string> = { 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5" };
  const opened = apps.find((a) => a.app_id === openId) || null;
  const stats = vacancy.stats;

  return (
    <div className="page">
      <Link to="/vacancies" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-700"><ArrowLeft className="h-4 w-4" />Все стажировки</Link>
      <section className="card mt-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{vacancy.title}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${vacancy.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{vacancy.is_active ? "Опубликована" : "Скрыта"}</span>
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              {(vacancy.city || vacancy.region) && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{[vacancy.city, vacancy.region].filter(Boolean).join(", ")}</span>}
              <span className="inline-flex items-center gap-1"><ClipboardList className="h-4 w-4" />{hasQuestions ? `${vacancy.test_questions.length} вопр. в задании` : "без задания"}</span>
              <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" />{apps.length} откликов</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {vacancy.core_skills.map((s) => <span key={s} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-inset ring-blue-200">{s} · ключевой</span>)}
              {vacancy.optional_skills.map((s) => <span key={s} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">{s}</span>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={load} className="btn-secondary px-3" aria-label="Обновить"><RotateCw className="h-4 w-4" /></button>
            <button onClick={exportCsv} disabled={exporting} className="btn-secondary px-3">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}CSV</button>
            <button onClick={toggleActive} className="btn-secondary px-3">{vacancy.is_active ? <><EyeOff className="h-4 w-4" />Скрыть</> : <><Send className="h-4 w-4" />Опубликовать</>}</button>
            <Link to={`/vacancies/${vacancy.vacancy_id}/edit`} className="btn-primary px-3"><Pencil className="h-4 w-4" />Изменить</Link>
          </div>
        </div>
        {stats && (
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-5">
            {[["Новых за сутки", stats.new_24h], ["Ждут решения", stats.pending], ["Ответили на задание", stats.answered], ["Приглашены", stats.accepted], ["Средний индекс", `${Math.round(stats.avg_match)}%`]].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-slate-50 px-3 py-2.5"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 text-lg font-bold tabular text-slate-900">{value}</dd></div>
            ))}
          </dl>
        )}
      </section>

      {apps.length === 0 ? (
        <div className="mt-6"><Empty illustration="/illustrations/empty-inbox.webp" icon={<Users className="h-6 w-6" />} title="Откликов пока нет" text="Студенты с индексом от 60% уже получили уведомление в MAX. Первые отклики обычно приходят в течение суток." /></div>
      ) : (
        <div className={`mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 ${gridCols[cols.length]}`}>
          {cols.map((col) => {
            const items = apps.filter(col.test);
            return (
              <div key={col.key}
                className={`flex min-h-[220px] flex-col rounded-2xl bg-slate-100/80 p-3 transition ${dragOver === col.key ? "ring-2 ring-blue-600" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); setDragOver(null); const appId = Number(e.dataTransfer.getData("text/app-id")); if (appId) dropTo(appId, col); }}>
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <h3 className="text-sm font-bold text-slate-700">{col.title}</h3>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">{items.length}</span>
                </div>
                {col.hint && <p className="mb-2 px-1 text-[11px] leading-4 text-slate-500">{col.hint}</p>}
                <div className="space-y-2">{items.map((a) => <CandidateCard key={a.app_id} app={a} hasQuestions={hasQuestions} onOpen={() => setOpenId(a.app_id)} onUndo={() => undo(a)} />)}</div>
              </div>
            );
          })}
        </div>
      )}

      {opened && !modal && (
        <CandidatePanel app={opened} onClose={() => setOpenId(null)}
          onInvite={() => setModal({ kind: "invite", app: opened })} onReject={() => setModal({ kind: "reject", app: opened })}
          onUndo={() => undo(opened)} onReturn={() => decide(opened, "pending")} />
      )}
      {modal?.kind === "invite" && <NextStepModal app={modal.app} profile={profile} onClose={() => setModal(null)} onSubmit={(step) => decide(modal.app, "accepted", { next_step: step })} />}
      {modal?.kind === "reject" && <RejectModal app={modal.app} onClose={() => setModal(null)} onSubmit={(message) => decide(modal.app, "rejected", { message })} />}
    </div>
  );
}
