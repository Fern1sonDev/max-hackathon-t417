import { BadgeCheck, CheckCircle2, ClipboardCheck, Eye, Handshake, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, humanError, type Profile, type SkillTest, type SkillTestInput } from "../lib/api";
import ErrorState from "../components/ErrorState";
import { Combobox, Empty, Modal, Skeleton, useToast } from "../components/ui";

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "Опубликован", cls: "bg-emerald-50 text-emerald-700" },
  pending: { label: "Ждёт одобрения вуза", cls: "bg-amber-50 text-amber-700" },
  draft: { label: "Черновик", cls: "bg-slate-100 text-slate-500" },
};

type QDraft = { text: string; options: string[]; correct_index: number };
const emptyQuestion = (): QDraft => ({ text: "", options: ["", "", ""], correct_index: 0 });

function TestEditor({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (t: SkillTest) => void }) {
  const toast = useToast();
  const curator = profile.role === "curator";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skill, setSkill] = useState("");
  const [passScore, setPassScore] = useState(70);
  const [partner, setPartner] = useState("");
  const [university, setUniversity] = useState("");
  const [questions, setQuestions] = useState<QDraft[]>([emptyQuestion(), emptyQuestion(), emptyQuestion()]);
  const [companies, setCompanies] = useState<{ user_id: string; name: string }[]>([]);
  const [universities, setUniversities] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listSkills().then((s) => setSkills(s.map((x) => x.name))).catch(() => {});
    if (curator) api.companies().then(setCompanies).catch(() => {});
    else api.universities().then((u) => setUniversities(u.filter((x) => x.has_curator).map((x) => x.name))).catch(() => {});
  }, [curator]);

  const valid = title.trim().length >= 3 && skill && questions.length >= 3 && questions.every((q) => q.text.trim().length >= 3 && q.options.filter((o) => o.trim()).length >= 2 && q.options[q.correct_index]?.trim()) && (curator || university);
  const setQ = (i: number, patch: Partial<QDraft>) => setQuestions((list) => list.map((q, k) => (k === i ? { ...q, ...patch } : q)));

  async function save(publish: boolean) {
    setBusy(true);
    try {
      const payload: SkillTestInput = {
        title: title.trim(), description: description.trim(), skill, pass_score: passScore, max_attempts: 3, publish,
        questions: questions.map((q) => {
          const opts = q.options.map((o) => o.trim());
          const kept = opts.filter(Boolean);
          return { text: q.text.trim(), options: kept, correct_index: kept.indexOf(opts[q.correct_index]) };
        }),
        ...(curator ? { partner_company_id: companies.find((c) => c.name === partner)?.user_id ?? null } : { university }),
      };
      const saved = await api.createTest(payload);
      toast("success", curator ? (publish ? "Тест опубликован — студенты вуза увидят его в мини-приложении" : "Черновик сохранён") : "Тест отправлен вузу — куратор опубликует его");
      onSaved(saved);
    } catch (e) {
      toast("error", humanError(e, "Не удалось сохранить тест"));
    } finally { setBusy(false); }
  }

  return (
    <Modal wide title={curator ? "Новый тест навыка" : "Предложить тест вузу"} onClose={onClose} footer={
      <div className="flex flex-wrap items-center justify-end gap-2">
        {curator && <button onClick={() => save(false)} disabled={busy || !valid} className="btn-secondary">Сохранить черновик</button>}
        <button onClick={() => save(true)} disabled={busy || !valid} className="btn-primary">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{curator ? "Опубликовать" : "Отправить вузу"}</button>
      </div>
    }>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label sm:col-span-2">Название<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Основы NetBox для стажёров" className="field" /></label>
        <Combobox label="Какой навык подтверждает" value={skill} options={skills} onChange={setSkill} placeholder="Выберите навык" />
        {curator
          ? <Combobox label="Работодатель-соавтор (необязательно)" value={partner} options={companies.map((c) => c.name)} onChange={setPartner} clearable="Без соавтора" placeholder="Без соавтора" />
          : <Combobox label="Вуз" value={university} options={universities} onChange={setUniversity} placeholder="Выберите вуз" />}
        <label className="label sm:col-span-2">Описание<input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Что проверяем и зачем — увидят студенты" className="field" /></label>
        <label className="label">Проходной балл, %<input type="number" min={50} max={100} value={passScore} onChange={(e) => setPassScore(Math.min(100, Math.max(50, Number(e.target.value) || 70)))} className="field" /></label>
      </div>
      <div className="mt-5 space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
              <input value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} maxLength={1000} placeholder="Вопрос" className="field mt-0" aria-label={`Вопрос ${i + 1}`} />
              {questions.length > 3 && <button onClick={() => setQuestions((l) => l.filter((_, k) => k !== i))} aria-label="Удалить вопрос" className="mt-1.5 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <div className="mt-2 space-y-1.5 pl-8">
              {q.options.map((o, k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${i}`} checked={q.correct_index === k} onChange={() => setQ(i, { correct_index: k })} className="h-4 w-4 accent-emerald-600" aria-label="Правильный ответ" />
                  <input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} maxLength={300} placeholder={`Вариант ${k + 1}`} className={`field mt-0 py-2 text-sm ${q.correct_index === k ? "border-emerald-300 bg-emerald-50/40" : ""}`} />
                </label>
              ))}
              {q.options.length < 6 && <button onClick={() => setQ(i, { options: [...q.options, ""] })} className="text-xs font-semibold text-blue-700 hover:underline">+ вариант</button>}
            </div>
          </div>
        ))}
        {questions.length < 20 && <button onClick={() => setQuestions((l) => [...l, emptyQuestion()])} className="btn-secondary px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" />Добавить вопрос</button>}
        <p className="text-xs text-slate-500">Отметьте правильный вариант кружком. Минимум 3 вопроса, у студента 3 попытки.</p>
      </div>
    </Modal>
  );
}

export default function Tests({ profile }: { profile: Profile }) {
  const toast = useToast();
  const curator = profile.role === "curator";
  const [tests, setTests] = useState<SkillTest[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<SkillTest | null>(null);

  function load() {
    setError("");
    api.listTests().then(setTests).catch((e) => setError(humanError(e, "Не удалось загрузить тесты")));
  }
  useEffect(load, []);

  async function publish(t: SkillTest, status: "draft" | "published") {
    try {
      const updated = await api.setTestStatus(t.test_id, status);
      setTests((list) => list && list.map((x) => (x.test_id === t.test_id ? updated : x)));
      toast("success", status === "published" ? "Тест опубликован" : "Тест снят с публикации");
    } catch (e) { toast("error", humanError(e, "Не удалось изменить статус")); }
  }

  async function remove(t: SkillTest) {
    if (!window.confirm(`Удалить тест «${t.title}»?`)) return;
    try { await api.deleteTest(t.test_id); setTests((list) => list && list.filter((x) => x.test_id !== t.test_id)); } catch (e) { toast("error", humanError(e, "Не удалось удалить")); }
  }

  async function open(t: SkillTest) {
    try { setPreview(await api.getTest(t.test_id)); } catch (e) { toast("error", humanError(e, "Не удалось открыть тест")); }
  }

  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{curator ? "Тесты навыков" : "Тесты с вузами"}</h1>
          <p className="page-sub">{curator ? "Студент сдал тест кафедры — навык подтверждён автоматически. Составляйте тесты вместе с работодателями-партнёрами." : "Предложите вузу тест по навыку, который вам важен: после одобрения куратора студенты сдают его в MAX, и навык подтверждается."}</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary"><Plus className="h-4 w-4" />{curator ? "Новый тест" : "Предложить тест"}</button>
      </div>

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}
      {!error && !tests && <div className="mt-6 grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-40" />)}</div>}
      {tests?.length === 0 && <div className="mt-6"><Empty illustration="/illustrations/empty-search.webp" icon={<ClipboardCheck className="h-6 w-6" />} title="Тестов пока нет" text={curator ? "Создайте первый тест — например, по навыку, который чаще всего требуют работодатели региона." : "Предложите вузу тест — это самый быстрый способ получить стажёров с проверенным навыком."} /></div>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {tests?.map((t) => {
          const st = STATUS[t.status] ?? STATUS.draft;
          return (
            <article key={t.test_id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900">{t.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{t.university.split(" (")[0]}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800"><BadgeCheck className="h-3.5 w-3.5" />{t.skill}</span>
                {t.partner_name && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-800"><Handshake className="h-3.5 w-3.5" />совместно с {t.partner_name}</span>}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{t.questions_count} вопр. · от {t.pass_score}%</span>
              </div>
              {t.description && <p className="mt-3 text-sm leading-6 text-slate-600">{t.description}</p>}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                <p className="text-xs text-slate-500">{t.attempts_total ? <><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />{t.attempts_total} попыток · сдали {t.pass_rate ?? 0}%</> : "Попыток пока нет"}</p>
                <div className="flex gap-2">
                  <button onClick={() => open(t)} className="btn-secondary px-3 py-2 text-xs"><Eye className="h-3.5 w-3.5" />Вопросы</button>
                  {curator && t.can_manage && t.status !== "published" && <button onClick={() => publish(t, "published")} className="btn-primary px-3 py-2 text-xs">Опубликовать</button>}
                  {curator && t.can_manage && t.status === "published" && <button onClick={() => publish(t, "draft")} className="btn-secondary px-3 py-2 text-xs">Снять</button>}
                  {t.can_manage && (curator || t.status !== "published") && <button onClick={() => remove(t)} aria-label="Удалить" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {creating && <TestEditor profile={profile} onClose={() => setCreating(false)} onSaved={(t) => { setCreating(false); setTests((list) => [t, ...(list ?? [])]); }} />}
      {preview && (
        <Modal wide title={preview.title} onClose={() => setPreview(null)}>
          <ol className="space-y-4">
            {preview.questions?.map((q, i) => (
              <li key={q.id ?? i}>
                <p className="text-sm font-semibold text-slate-900">{i + 1}. {q.text}</p>
                <ul className="mt-2 space-y-1">{q.options.map((o, k) => <li key={k} className={`rounded-lg px-3 py-1.5 text-sm ${q.correct_index === k ? "bg-emerald-50 font-semibold text-emerald-800" : "bg-slate-50 text-slate-600"}`}>{o}</li>)}</ul>
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  );
}
