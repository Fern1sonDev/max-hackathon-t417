import { ArrowLeft, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, humanError, type Vacancy } from "../lib/api";
import ErrorState from "../components/ErrorState";
import { PlacePicker, Skeleton, useToast } from "../components/ui";

const PRESETS = [
  {
    title: "Стажёр по сетевой инфраструктуре",
    core: ["Linux", "Защищённые сетевые соединения", "NetBox"],
    optional: ["Zabbix"],
    questions: [
      "Защищённое соединение установлено, но внутренний ресурс недоступен. Какие три проверки вы выполните в первую очередь?",
      "Как бы вы описали в NetBox новый коммутатор в стойке: какие объекты создадите и в каком порядке?",
    ],
  },
  {
    title: "Стажёр-администратор мониторинга",
    core: ["Linux", "Zabbix"],
    optional: ["Proxmox"],
    questions: [
      "Какие метрики Linux-сервера вы добавили бы в мониторинг в первую очередь и почему?",
      "Как настроить уведомление о нехватке места на диске так, чтобы оно не будило дежурного из-за временных файлов?",
    ],
  },
  {
    title: "Frontend-стажёр",
    core: ["React", "TypeScript"],
    optional: ["Git"],
    questions: [
      "Как показать состояния загрузки, пустого списка и ошибки при запросе к API в React? Коротко опишите компонент.",
      "Чем type отличается от interface в TypeScript и что вы выберете для пропсов компонента?",
      "Ссылка на ваш GitHub или пример кода (если есть).",
    ],
  },
];

type Level = "core" | "optional";

function Editor({ editing }: { editing?: Vacancy }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [questions, setQuestions] = useState<string[]>(editing?.test_questions.length ? editing.test_questions : [""]);
  const [region, setRegion] = useState(editing?.region ?? "");
  const [city, setCity] = useState(editing?.city ?? "");
  const [catalog, setCatalog] = useState<string[]>([]);
  const [levels, setLevels] = useState<Record<string, Level>>(() => {
    const init: Record<string, Level> = {};
    (editing?.core_skills ?? []).forEach((s) => (init[s] = "core"));
    (editing?.optional_skills ?? []).forEach((s) => (init[s] = "optional"));
    return init;
  });
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.listSkills().then((skills) => setCatalog(skills.map((s) => s.name))).catch(() => {}); }, []);

  const core = Object.keys(levels).filter((s) => levels[s] === "core");
  const optional = Object.keys(levels).filter((s) => levels[s] === "optional");
  const allSkills = Array.from(new Set([...catalog, ...Object.keys(levels)]));
  const totalWeight = core.length * 2 + optional.length;
  const filledQuestions = questions.map((q) => q.trim()).filter(Boolean);

  function cycle(skill: string) {
    setLevels((prev) => {
      const next = { ...prev };
      if (!prev[skill]) next[skill] = "core";
      else if (prev[skill] === "core") next[skill] = "optional";
      else delete next[skill];
      return next;
    });
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setTitle(p.title);
    setQuestions(p.questions);
    const next: Record<string, Level> = {};
    p.core.forEach((s) => (next[s] = "core"));
    p.optional.forEach((s) => (next[s] = "optional"));
    setLevels(next);
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const payload = { title: title.trim(), description, test_questions: filledQuestions, region, city, required_skills: core, optional_skills: optional };
      const saved = editing ? await api.updateVacancy(editing.vacancy_id, payload) : await api.createVacancy(payload);
      toast("success", editing ? "Изменения сохранены" : "Стажировка опубликована — подходящим студентам ушло уведомление в MAX");
      navigate(`/vacancies/${saved.vacancy_id}`);
    } catch (e) {
      setError(humanError(e, "Не удалось сохранить стажировку"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page max-w-5xl">
      <Link to={editing ? `/vacancies/${editing.vacancy_id}` : "/vacancies"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-700"><ArrowLeft className="h-4 w-4" />Назад</Link>
      <h1 className="page-title mt-3">{editing ? "Редактирование стажировки" : "Новая стажировка"}</h1>
      {!editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Начать с шаблона:</span>
          {PRESETS.map((p) => <button key={p.title} onClick={() => applyPreset(p)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700">{p.title}</button>)}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="card space-y-4 p-6">
          <label className="label">Название<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Например, стажёр по сетевой инфраструктуре" className="field" /></label>
          <label className="label">Задачи и условия<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={4} placeholder="Чем займётся стажёр, наставник, график, оплата, перспектива перехода в штат" className="field" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><PlacePicker region={region} city={city} onChange={(r, c) => { setRegion(r); setCity(c); }} /></div>
          <div>
            <p className="label">Тестовое задание</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Вопросы придут студенту в чат MAX сразу после отклика — он ответит в чате или в мини-приложении. До 10 вопросов, лучше 2–3 на 15–30 минут.</p>
            <ol className="mt-3 space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
                  <textarea value={q} onChange={(e) => setQuestions((list) => list.map((v, k) => (k === i ? e.target.value : v)))} maxLength={1000} rows={3} placeholder="Вопрос или мини-задача" className="field mt-0" aria-label={`Вопрос ${i + 1}`} />
                  <button onClick={() => setQuestions((list) => (list.length > 1 ? list.filter((_, k) => k !== i) : [""]))} aria-label={`Удалить вопрос ${i + 1}`} className="mt-2 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ol>
            {questions.length < 10 && <button onClick={() => setQuestions((list) => [...list, ""])} className="btn-secondary mt-2 px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" />Добавить вопрос</button>}
          </div>
        </section>

        <section className="card p-6">
          <p className="label">Требуемые навыки</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Один клик — <b className="text-blue-700">ключевой (вес 2)</b>, второй — <b className="text-slate-700">желательный (вес 1)</b>, третий — убрать.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {allSkills.map((s) => {
              const level = levels[s];
              const cls = level === "core" ? "bg-blue-700 text-white" : level === "optional" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200";
              return <button key={s} onClick={() => cycle(s)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${cls}`}>{s}{level === "core" ? " · ключевой" : level === "optional" ? " · желательный" : ""}</button>;
            })}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); const n = custom.trim(); if (n) { setLevels((p) => ({ ...p, [n]: p[n] || "core" })); setCustom(""); } }} className="mt-3 flex gap-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={60} placeholder="Добавить свой навык…" className="field mt-0" />
            <button type="submit" disabled={!custom.trim()} className="btn-secondary px-3" aria-label="Добавить навык"><Plus className="h-4 w-4" /></button>
          </form>
          {totalWeight > 0 && (
            <div className="mt-5 rounded-2xl bg-blue-50/70 p-4 text-xs leading-5 text-slate-600">
              <p className="flex items-center gap-1.5 font-bold text-blue-800"><Sparkles className="h-3.5 w-3.5" />Как считается индекс кандидата</p>
              <p className="mt-1">Ключевой навык весит {Math.round((2 / totalWeight) * 100)}%, желательный — {Math.round((1 / totalWeight) * 100)}%. Подтверждённый вузом навык засчитывается полностью, «на усмотрение работодателя» — на 75%, заявленный студентом — наполовину, смежный — наполовину от своего статуса.</p>
            </div>
          )}
        </section>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {core.length === 0 && <p className="text-xs text-slate-400">Отметьте хотя бы один ключевой навык</p>}
        <button onClick={submit} disabled={saving || title.trim().length < 3 || core.length === 0} className="btn-primary min-w-56">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Сохраняем…" : editing ? "Сохранить изменения" : "Опубликовать стажировку"}
        </button>
      </div>
    </div>
  );
}

export default function VacancyForm() {
  const { id } = useParams();
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (id) api.getVacancy(Number(id)).then(setVacancy).catch((e) => setError(humanError(e, "Не удалось загрузить стажировку")));
  }, [id]);
  if (!id) return <Editor />;
  if (error) return <div className="page"><ErrorState message={error} onRetry={() => window.location.reload()} /></div>;
  if (!vacancy) return <div className="page"><Skeleton className="h-96" /></div>;
  return <Editor editing={vacancy} />;
}
