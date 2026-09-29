import { CalendarClock, Inbox, Loader2, MapPin, MessageCircle, Phone, RotateCw, Send, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, botChatLink, type Application } from "../lib/api";
import { haptic, openMax, setClosingConfirmation } from "../lib/max";
import { StatusPill } from "../components/StatusPill";
import { EmptyState, ErrorBox, MatchRing, Skeleton, useToast } from "../components/ui";

const EVENT_DOT: Record<string, string> = { created: "bg-blue-600", answered: "bg-violet-600", accepted: "bg-emerald-500", rejected: "bg-slate-400", missed: "bg-amber-500", pending: "bg-blue-400" };
const FORMAT_LABEL: Record<string, string> = { online: "Онлайн-собеседование", office: "Собеседование в офисе", call: "Созвон с HR", start: "Выход на стажировку" };

function formatDate(value: string) {
  return new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function NextSteps({ application }: { application: Application }) {
  const step = application.next_step;
  if (!step) return null;
  const phone = step.contact_phone || application.company_contact;
  return (
    <section className="mt-4 overflow-hidden rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
      <div className="bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">Следующий шаг: {FORMAT_LABEL[step.format] ?? "собеседование"}</div>
      <div className="space-y-2 p-4 text-sm text-emerald-950">
        {step.datetime && <p className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />{step.datetime}</p>}
        {step.place && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{step.place}</p>}
        {step.contact_name && <p className="flex items-start gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0" />{step.contact_name}</p>}
        {step.message && <p className="whitespace-pre-line rounded-xl bg-white/70 p-3 leading-6">{step.message}</p>}
        {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="btn-primary mt-2 w-full !bg-emerald-600 hover:!bg-emerald-700"><Phone className="h-4 w-4" />Позвонить: {phone}</a>}
      </div>
    </section>
  );
}

function ApplicationCard({ application, onUpdated }: { application: Application; onUpdated: (a: Application) => void }) {
  const toast = useToast();
  const questions = application.test_questions;
  const [drafts, setDrafts] = useState<string[]>(() => questions.map((_, i) => application.test_answers[i] ?? ""));
  const [busy, setBusy] = useState(false);
  const canAnswer = application.status === "pending" && questions.length > 0;
  const answered = Boolean(application.test_answer || application.test_answers.length);
  const complete = drafts.length > 0 && drafts.every((d) => d.trim());
  const dirty = drafts.some((d, i) => d.trim() !== (application.test_answers[i] ?? "").trim());

  useEffect(() => { setClosingConfirmation(dirty && canAnswer); return () => setClosingConfirmation(false); }, [dirty, canAnswer]);

  async function send() {
    setBusy(true);
    try {
      const updated = await api.answerApplication(application.app_id, drafts.map((d) => d.trim()));
      onUpdated(updated);
      haptic.success();
      toast("success", "Ответ отправлен работодателю");
    } catch (e) {
      haptic.error();
      toast("error", e instanceof ApiError ? e.message : "Не удалось отправить ответ. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug text-slate-900">{application.vacancy_title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{application.company_name} · отклик #{application.app_id}</p>
          <div className="mt-2"><StatusPill status={application.status} /></div>
        </div>
        <MatchRing score={application.match_score} potential={application.match?.potential} size={52} />
      </div>

      <NextSteps application={application} />

      {application.events.length > 0 && (
        <ol className="mt-4 space-y-2.5 border-l-2 border-slate-100 pl-4">
          {application.events.map((event, index) => (
            <li key={index} className="relative text-xs">
              <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${EVENT_DOT[event.kind] || "bg-slate-300"}`} />
              <span className="font-semibold text-slate-800">{event.note}</span>
              <span className="ml-1.5 text-slate-400">{formatDate(event.created_at)}</span>
            </li>
          ))}
        </ol>
      )}

      {canAnswer && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Тестовое задание · {questions.length} {questions.length === 1 ? "вопрос" : "вопроса"}</p>
          <div className="mt-2 space-y-4">
            {questions.map((q, i) => (
              <div key={i}>
                <p className="text-sm font-medium leading-6 text-slate-800">{questions.length > 1 ? `${i + 1}. ` : ""}{q}</p>
                <textarea value={drafts[i]} onChange={(e) => setDrafts((d) => d.map((v, k) => (k === i ? e.target.value : v)))} maxLength={10000} rows={3} placeholder="Ваш ответ…" aria-label={`Ответ на вопрос ${i + 1}`} className="field resize-y" />
              </div>
            ))}
          </div>
          {answered && !application.test_answers.length && <p className="mt-2 rounded-xl bg-white p-2.5 text-xs text-slate-500 ring-1 ring-slate-200">Ответ из чата: {application.test_answer}</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button onClick={() => openMax(botChatLink)} className="btn-ghost"><MessageCircle className="h-3.5 w-3.5" />Открыть чат</button>
            <button onClick={send} disabled={busy || !complete || !dirty} className="btn-primary px-3.5 py-2 text-xs">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{answered ? "Обновить ответ" : "Отправить"}
            </button>
          </div>
        </div>
      )}

      {!canAnswer && answered && application.status !== "accepted" && (
        <details className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-sm">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500">Ваш ответ на задание</summary>
          <div className="mt-2 space-y-2">
            {(application.test_answers.length ? application.test_answers : [application.test_answer]).map((a, i) => (
              <p key={i} className="whitespace-pre-wrap text-slate-700">{questions.length > 1 && application.test_answers.length ? <b>{i + 1}. </b> : null}{a}</p>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

export default function Applications({ onGoToFeed, refreshKey }: { onGoToFeed: () => void; refreshKey: number }) {
  const [items, setItems] = useState<Application[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    setError("");
    setRefreshing(true);
    api.listMyApplications()
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить отклики"))
      .finally(() => setRefreshing(false));
  }

  useEffect(load, [refreshKey]);
  useEffect(() => {
    const timer = window.setInterval(() => document.visibilityState === "visible" && api.listMyApplications().then(setItems).catch(() => {}), 20000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Мои отклики</h1>
          <p className="mt-0.5 text-xs text-slate-500">Статусы обновляются сами · уведомления приходят в чат MAX</p>
        </div>
        <button onClick={load} aria-label="Обновить" className="rounded-xl bg-white p-2.5 text-slate-500 ring-1 ring-slate-200 active:scale-95"><RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button>
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!error && items === null && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-44" />)}</div>}
      {!error && items && items.length === 0 && (
        <EmptyState illustration="/illustrations/empty-inbox.webp" icon={<Inbox className="h-6 w-6" />} title="Откликов пока нет" text="Выберите стажировку в ленте — откликнуться можно в один тап, а задание придёт в чат." action={<button onClick={onGoToFeed} className="btn-primary">Перейти в ленту</button>} />
      )}
      {items?.map((application) => (
        <ApplicationCard key={`${application.app_id}-${application.status}`} application={application} onUpdated={(u) => setItems((list) => list && list.map((a) => (a.app_id === u.app_id ? u : a)))} />
      ))}
    </div>
  );
}
