import { BadgeCheck, CalendarClock, Check, Copy, FileText, Loader2, Mail, MapPin, MessageSquareText, Phone, RotateCw, Send, Undo2, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDate, parseUtc, type Application, type NextStep, type Profile } from "../lib/api";
import { Avatar, ChipLegend, Drawer, MatchRing, Modal, SkillChip, copyText, useToast } from "./ui";

export const FORMAT_LABEL: Record<NextStep["format"], string> = { call: "Созвон с HR", online: "Онлайн-собеседование", office: "Собеседование в офисе", start: "Выход на стажировку" };

/** Seconds left until the decision reaches the student (0 = delivered / none). */
export function useSecondsLeft(until: string | null): number {
  const calc = () => (until ? Math.max(0, Math.ceil((parseUtc(until) - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!until) return;
    const timer = window.setInterval(() => setLeft(calc()), 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return left;
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---- invite: next steps -----------------------------------------------------------------------

const TEMPLATES: { format: NextStep["format"]; title: string; message: string }[] = [
  { format: "call", title: "Короткий созвон", message: "Позвоним, чтобы познакомиться и рассказать о задачах стажировки — это займёт 15 минут. Если время неудобно, напишите или позвоните нам." },
  { format: "online", title: "Онлайн-собеседование", message: "Приглашаем на онлайн-собеседование с руководителем направления: обсудим ваш ответ на задание и план стажировки. Ссылка на встречу — выше." },
  { format: "office", title: "Встреча в офисе", message: "Ждём вас в офисе. Возьмите паспорт для пропуска — на ресепшене назовите имя контактного лица." },
  { format: "start", title: "Выход на стажировку", message: "Поздравляем — вы приняты на стажировку! В первый день познакомим с наставником и выдадим доступы. Возьмите паспорт и студенческий." },
];

export function NextStepModal({ app, profile, onClose, onSubmit }: { app: Application; profile: Profile; onClose: () => void; onSubmit: (step: NextStep) => Promise<void> }) {
  const [step, setStep] = useState<NextStep>({ format: "call", datetime: "", place: "", contact_name: (profile.is_owner && profile.role === "hr" ? profile.person_name : profile.name) || profile.name, contact_phone: profile.phone, message: TEMPLATES[0].message });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<NextStep>) => setStep((s) => ({ ...s, ...patch }));
  const needsPlace = step.format === "online" || step.format === "office" || step.format === "start";

  async function submit() {
    setBusy(true);
    try { await onSubmit(step); } finally { setBusy(false); }
  }

  return (
    <Modal wide title={`Пригласить: ${app.student_name}`} onClose={onClose} footer={
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs text-slate-500">Сообщение уйдёт в MAX через 90 секунд — до этого решение можно отменить.</p>
        <button onClick={submit} disabled={busy} className="btn-primary shrink-0 !bg-emerald-600 hover:!bg-emerald-700 !shadow-none">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Пригласить</button>
      </div>
    }>
      <p className="text-sm font-semibold text-slate-700">Что дальше</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEMPLATES.map((t) => (
          <button key={t.format} type="button" onClick={() => set({ format: t.format, message: t.message })} aria-pressed={step.format === t.format} className={`rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${step.format === t.format ? "bg-blue-700 text-white shadow-lift" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>{t.title}</button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="label">Когда<input value={step.datetime} onChange={(e) => set({ datetime: e.target.value })} maxLength={60} placeholder="3 октября, 14:00" className="field" /></label>
        <label className="label">{step.format === "online" ? "Ссылка на встречу" : "Адрес"}{!needsPlace && <span className="font-normal text-slate-400"> — необязательно</span>}<input value={step.place} onChange={(e) => set({ place: e.target.value })} maxLength={300} placeholder={step.format === "online" ? "https://…" : "Ставрополь, ул. Ленина, 1, офис 305"} className="field" /></label>
        <label className="label">Контактное лицо<input value={step.contact_name} onChange={(e) => set({ contact_name: e.target.value })} maxLength={120} className="field" /></label>
        <label className="label">Телефон для связи<input value={step.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} maxLength={40} inputMode="tel" placeholder="Пусто — телефон компании из настроек" className="field" /></label>
      </div>
      <label className="label mt-3">Сообщение кандидату<textarea value={step.message} onChange={(e) => set({ message: e.target.value })} maxLength={2000} rows={3} className="field" /></label>
      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 ring-1 ring-emerald-200">
        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Так студент увидит приглашение в MAX</p>
        <p className="mt-2 font-semibold">🎉 {profile.org_name || "Компания"} приглашает вас на следующий этап по стажировке «{app.vacancy_title}».</p>
        <p className="mt-1">Что дальше: {FORMAT_LABEL[step.format]}{step.datetime ? ` · ${step.datetime}` : ""}{step.place ? ` · ${step.place}` : ""}</p>
        {(step.contact_name || step.contact_phone) && <p>Контакт: {[step.contact_name, step.contact_phone].filter(Boolean).join(" · ")}</p>}
        {step.message && <p className="mt-2 whitespace-pre-line text-emerald-900/80">{step.message}</p>}
      </div>
    </Modal>
  );
}

// ---- reject ----------------------------------------------------------------------------------------

export function RejectModal({ app, onClose, onSubmit }: { app: Application; onClose: () => void; onSubmit: (message: string) => Promise<void> }) {
  const missing = app.match?.missing_core ?? [];
  const templates = [
    { title: "Выбрали другого кандидата", text: `Спасибо за отклик на «${app.vacancy_title}». Сейчас мы выбрали кандидата с большим опытом, но сохраним ваш профиль и напишем, когда откроется похожая стажировка.` },
    ...(missing.length ? [{ title: "Не хватает навыков", text: `Спасибо за отклик! Для этой стажировки важны: ${missing.join(", ")}. Подтвердите эти навыки в вузе или пройдите тест — и откликайтесь снова, будем рады.` }] : []),
    { title: "Набор закрыт", text: `Спасибо за интерес к «${app.vacancy_title}». Набор на эту стажировку уже закрыт — следите за новыми предложениями в ленте ПрактикаПлюс.` },
  ];
  const [message, setMessage] = useState(templates[0].text);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Отказ: ${app.student_name}`} onClose={onClose} footer={
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs text-slate-500">Уйдёт через 90 секунд, до этого можно отменить.</p>
        <button onClick={async () => { setBusy(true); try { await onSubmit(message); } finally { setBusy(false); } }} disabled={busy} className="btn-primary shrink-0 !bg-rose-600 hover:!bg-rose-700 !shadow-none">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}Отправить отказ</button>
      </div>
    }>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => <button key={t.title} type="button" onClick={() => setMessage(t.text)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${message === t.text ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t.title}</button>)}
      </div>
      <label className="label mt-4">Сообщение кандидату<textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={5} className="field" /></label>
      <p className="mt-2 text-xs text-slate-500">Вежливый отказ с причиной — студент понимает, что подтянуть, а вуз видит спрос на навыки.</p>
    </Modal>
  );
}

// ---- candidate card -----------------------------------------------------------------------------

export function CandidatePanel({ app, onClose, onInvite, onReject, onUndo, onReturn }: {
  app: Application; onClose: () => void; onInvite: () => void; onReject: () => void; onUndo: () => void; onReturn: () => void;
}) {
  const toast = useToast();
  const left = useSecondsLeft(app.pending_decision_until);
  const match = app.match;
  const questions = app.test_questions.length ? app.test_questions : app.test_task ? [app.test_task] : [];
  const answers = app.test_answers.length ? app.test_answers : app.test_answer ? [app.test_answer] : [];
  const phoneHref = app.student_phone ? `tel:${app.student_phone.replace(/[^\d+]/g, "")}` : "";

  return (
    <Drawer label={app.student_name} onClose={onClose}>
      <div className="flex items-start gap-4 border-b border-slate-100 p-6">
        <Avatar name={app.student_name} size={56} src={app.student_avatar_url} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">{app.student_name}</h2>
          <p className="text-sm text-slate-500">{[app.student_university.split(" (")[0], app.student_group].filter(Boolean).join(" · ") || "Вуз не указан"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {app.student_phone && <a href={phoneHref} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"><Phone className="h-4 w-4" />{app.student_phone}</a>}
            {app.student_phone && <button onClick={() => copyText(app.student_phone).then((ok) => ok && toast("success", "Телефон скопирован"))} className="rounded-xl p-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-700" aria-label="Скопировать телефон"><Copy className="h-4 w-4" /></button>}
            {app.student_contact && <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200"><Mail className="h-4 w-4 text-slate-400" />{app.student_contact}</span>}
          </div>
        </div>
        <button onClick={onClose} aria-label="Закрыть" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <section className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
          <MatchRing score={app.match_score} verified={match?.verified_score} size={72} />
          <div className="text-sm">
            <p className="font-bold text-slate-900">Индекс соответствия {Math.round(app.match_score)}%</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              <span className="font-semibold text-emerald-700">Подтверждено вузом: {Math.round(match?.verified_score ?? 0)}%.</span> Остальное — заявленные студентом навыки (засчитываются наполовину) и решения «на усмотрение работодателя».
            </p>
          </div>
        </section>

        {match && (
          <section>
            <h3 className="text-sm font-bold text-slate-900">Требования стажировки</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">{match.items.map((i) => <SkillChip key={i.skill} item={i} />)}</div>
            <div className="mt-2.5"><ChipLegend /></div>
          </section>
        )}

        {questions.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileText className="h-4 w-4 text-blue-700" />Тестовое задание · {questions.length} {questions.length === 1 ? "вопрос" : "вопроса"}</h3>
            <ol className="mt-3 space-y-3">
              {questions.map((q, i) => (
                <li key={i} className="rounded-2xl border border-slate-200/80 p-3.5">
                  <p className="text-sm font-semibold text-slate-800">{questions.length > 1 ? `${i + 1}. ` : ""}{q}</p>
                  {answers[i]
                    ? <p className="mt-2 whitespace-pre-wrap rounded-xl bg-violet-50/70 p-3 text-sm leading-6 text-slate-800 ring-1 ring-inset ring-violet-200">{answers[i]}</p>
                    : <p className="mt-2 text-xs text-slate-400">{app.status === "pending" ? "Ответа пока нет — вопросы пришли студенту в чат MAX." : "Без ответа."}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {app.next_step && app.status === "accepted" && (
          <section className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 ring-1 ring-emerald-200">
            <p className="font-bold">Следующий шаг: {FORMAT_LABEL[app.next_step.format]}</p>
            <div className="mt-2 space-y-1 text-emerald-900/90">
              {app.next_step.datetime && <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />{app.next_step.datetime}</p>}
              {app.next_step.place && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{app.next_step.place}</p>}
              {(app.next_step.contact_name || app.next_step.contact_phone) && <p className="flex items-center gap-2"><UserRound className="h-4 w-4" />{[app.next_step.contact_name, app.next_step.contact_phone].filter(Boolean).join(" · ")}</p>}
              {app.next_step.message && <p className="flex items-start gap-2"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />{app.next_step.message}</p>}
            </div>
          </section>
        )}

        {app.events.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-slate-900">История</h3>
            <ol className="mt-3 space-y-2.5 border-l-2 border-slate-100 pl-4">
              {app.events.map((e, i) => <li key={i} className="relative text-sm"><span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${e.kind === "undone" ? "bg-amber-500" : e.kind === "accepted" ? "bg-emerald-500" : e.kind === "rejected" ? "bg-slate-400" : "bg-blue-600"}`} /><span className="font-medium text-slate-800">{e.note}</span><span className="ml-2 text-xs text-slate-400">{formatDate(e.created_at)}</span></li>)}
            </ol>
          </section>
        )}
      </div>

      <div className="border-t border-slate-100 bg-white p-5">
        {left > 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-slate-900 p-3 pl-4 text-white">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-bold tabular">{mmss(left)}</span>
            <p className="flex-1 text-sm">{app.status === "accepted" ? "Приглашение" : "Отказ"} уйдёт студенту через {left} с</p>
            <button onClick={onUndo} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-900 hover:bg-blue-50"><Undo2 className="h-4 w-4" />Отменить</button>
          </div>
        ) : app.status === "pending" ? (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onReject} className="btn-secondary text-rose-700"><X className="h-4 w-4" />Отказать</button>
            <button onClick={onInvite} className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !shadow-none"><Check className="h-4 w-4" />Пригласить</button>
          </div>
        ) : app.status === "missed" ? (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onReject} className="btn-secondary text-rose-700"><X className="h-4 w-4" />Отказать</button>
            <button onClick={onInvite} className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !shadow-none"><Check className="h-4 w-4" />Всё же пригласить</button>
          </div>
        ) : (
          <button onClick={onReturn} className="btn-secondary w-full"><RotateCw className="h-4 w-4" />Вернуть на рассмотрение</button>
        )}
        {app.skills_verified && <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" />Все требования подтверждены вузом</p>}
      </div>
    </Drawer>
  );
}
