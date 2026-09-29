import { Layers, LayoutList, SearchX, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type Profile, type SkillTest, type StudentSkill, type Vacancy } from "../lib/api";
import TestSheet from "../components/TestSheet";
import { haptic } from "../lib/max";
import SwipeCard from "../components/SwipeCard";
import VacancyCard from "../components/VacancyCard";
import VacancySheet from "../components/VacancySheet";
import { EmptyState, ErrorBox, Skeleton, pluralize, useToast } from "../components/ui";

type Mode = "list" | "swipe";

export default function Feed({ profile, openVacancyId, onConsumedDeepLink, onApplied, onGoToProfile, onGoToApplications }: {
  profile: Profile;
  openVacancyId: number | null;
  onConsumedDeepLink: () => void;
  onApplied: () => void;
  onGoToProfile: () => void;
  onGoToApplications: () => void;
}) {
  const toast = useToast();
  const [vacancies, setVacancies] = useState<Vacancy[] | null>(null);
  const [skills, setSkills] = useState<StudentSkill[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [onlyFit, setOnlyFit] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [opened, setOpened] = useState<Vacancy | null>(null);
  const [tests, setTests] = useState<SkillTest[]>([]);
  const [openTest, setOpenTest] = useState<number | null>(null);

  const load = useCallback((filter: string[]) => {
    setError("");
    Promise.all([api.listVacancies(filter), api.mySkills()])
      .then(([items, mine]) => { setVacancies(items); setSkills(mine); setSwipeIndex(0); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить стажировки"));
  }, []);

  useEffect(() => { load(selectedTags); }, [selectedTags, load]);
  useEffect(() => { api.listTests().then(setTests).catch(() => {}); }, []);
  useEffect(() => { api.listSkills("vacancies").then((s) => setTags(s.map((x) => x.name))).catch(() => {}); }, []);

  // Deep link `startapp=vac_<id>` (shared vacancy / bot notification) opens the card directly.
  useEffect(() => {
    if (!openVacancyId) return;
    api.getVacancy(openVacancyId)
      .then(setOpened)
      .catch((e) => toast("error", e instanceof ApiError ? e.message : "Стажировка недоступна"))
      .finally(onConsumedDeepLink);
  }, [openVacancyId, onConsumedDeepLink, toast]);

  async function apply(vacancy: Vacancy) {
    setBusyId(vacancy.vacancy_id);
    try {
      const application = await api.apply(vacancy.vacancy_id);
      const update = (v: Vacancy) => (v.vacancy_id === vacancy.vacancy_id ? { ...v, my_application_status: application.status } : v);
      setVacancies((items) => items && items.map(update));
      setOpened((v) => (v ? update(v) : v));
      haptic.success();
      toast("success", vacancy.has_test_task ? "Отклик отправлен! Тестовое задание уже в чате с ботом MAX." : "Отклик отправлен! Решение компании придёт в чат MAX.");
      onApplied();
    } catch (e) {
      haptic.error();
      toast("error", e instanceof ApiError ? e.message : "Не удалось откликнуться. Повторите попытку.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => (vacancies ?? []).filter((v) => !onlyFit || (v.match_score ?? 0) >= 50), [vacancies, onlyFit]);
  const swipeQueue = visible.filter((v) => !v.my_application_status);
  const verified = skills.filter((s) => s.status === "verified").length;
  const pending = skills.filter((s) => s.status === "claimed").length;
  const best = (vacancies ?? []).reduce<Vacancy | null>((top, v) => ((v.match_score ?? 0) > (top?.match_score ?? -1) ? v : top), null);
  const firstName = profile.name.split(" ")[0] || profile.name;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-brand p-5 text-white shadow-lift">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm text-white/80">Привет, {firstName}!</p>
        {skills.length === 0 ? (
          <>
            <p className="mt-1 text-lg font-bold leading-snug">Добавьте навыки — и лента подстроится под вас</p>
            <button onClick={onGoToProfile} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 active:scale-[.98]"><Sparkles className="h-4 w-4" />Добавить навыки</button>
          </>
        ) : (
          <>
            <p className="mt-1 text-lg font-bold leading-snug">
              {best && (best.match_score ?? 0) > 0 ? <>Лучшее совпадение — {Math.round(best.match_score ?? 0)}%<br /><span className="text-sm font-medium text-white/85">{best.title}</span></> : <>Навыки ждут подтверждения куратора</>}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/15 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xl font-bold tabular"><ShieldCheck className="h-4 w-4" />{verified}</p>
                <p className="text-[11px] font-medium text-white/80">подтвердил куратор</p>
              </div>
              <div className="rounded-2xl bg-white/15 px-3 py-2.5">
                <p className="text-xl font-bold tabular">{pending}</p>
                <p className="text-[11px] font-medium text-white/80">ждут проверки</p>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="flex items-center gap-2">
        <div className="no-scrollbar -mx-4 flex flex-1 gap-1.5 overflow-x-auto px-4 py-0.5">
          <button onClick={() => { haptic.select(); setOnlyFit((v) => !v); }} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-xs font-semibold transition ${onlyFit ? "bg-blue-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            <SlidersHorizontal className="h-3.5 w-3.5" />Подходят от 50%
          </button>
          {tags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button key={tag} onClick={() => { haptic.select(); setSelectedTags((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag])); }} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
                {tag}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200">
          <button aria-label="Списком" aria-pressed={mode === "list"} onClick={() => setMode("list")} className={`rounded-lg p-1.5 ${mode === "list" ? "bg-blue-50 text-blue-700" : "text-slate-400"}`}><LayoutList className="h-4 w-4" /></button>
          <button aria-label="Карточками" aria-pressed={mode === "swipe"} onClick={() => setMode("swipe")} className={`rounded-lg p-1.5 ${mode === "swipe" ? "bg-blue-50 text-blue-700" : "text-slate-400"}`}><Layers className="h-4 w-4" /></button>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={() => load(selectedTags)} />}

      {!error && vacancies === null && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>}

      {!error && vacancies && visible.length === 0 && (
        <EmptyState
          illustration="/illustrations/empty-search.webp"
          icon={<SearchX className="h-6 w-6" />}
          title={selectedTags.length || onlyFit ? "По этим фильтрам пусто" : "Пока нет открытых стажировок"}
          text={selectedTags.length || onlyFit ? "Сбросьте фильтры — мы запомнили, что вы искали, и покажем этот спрос вузам и компаниям." : "Мы напишем в чат MAX, как только появится подходящая стажировка."}
          action={(selectedTags.length > 0 || onlyFit) && <button onClick={() => { setSelectedTags([]); setOnlyFit(false); }} className="btn-secondary">Сбросить фильтры</button>}
        />
      )}

      {!error && mode === "list" && visible.length > 0 && (
        <>
          <p className="px-1 text-xs font-medium text-slate-500">{visible.length} {pluralize(visible.length, "стажировка", "стажировки", "стажировок")} · сначала самые подходящие</p>
          <div className="space-y-3">
            {visible.map((v) => <VacancyCard key={v.vacancy_id} vacancy={v} busy={busyId === v.vacancy_id} onOpen={() => setOpened(v)} onApply={() => apply(v)} />)}
          </div>
        </>
      )}

      {!error && mode === "swipe" && vacancies && visible.length > 0 && (
        swipeIndex >= swipeQueue.length ? (
          <EmptyState illustration="/illustrations/success.webp" icon={<Layers className="h-6 w-6" />} title="Вы просмотрели всё" text="Новые стажировки появятся в ленте — бот сообщит о подходящих." action={<button onClick={() => setSwipeIndex(0)} className="btn-secondary">Смотреть заново</button>} />
        ) : (
          <SwipeCard
            key={swipeQueue[swipeIndex].vacancy_id}
            vacancy={swipeQueue[swipeIndex]}
            position={`${swipeIndex + 1} из ${swipeQueue.length}`}
            busy={busyId === swipeQueue[swipeIndex].vacancy_id}
            onOpen={() => setOpened(swipeQueue[swipeIndex])}
            onSkip={() => { haptic.tap(); setSwipeIndex((i) => i + 1); }}
            onApply={() => { const v = swipeQueue[swipeIndex]; apply(v); setSwipeIndex((i) => i + 1); }}
          />
        )
      )}

      <VacancySheet
        vacancy={opened}
        onClose={() => setOpened(null)}
        onApply={apply}
        busy={busyId === opened?.vacancy_id}
        onGoToApplications={() => { setOpened(null); onGoToApplications(); }}
        testsBySkill={Object.fromEntries(tests.map((t) => [t.skill.toLowerCase(), t]))}
        onOpenTest={(id) => { setOpened(null); setOpenTest(id); }}
      />
      <TestSheet
        testId={openTest}
        onClose={() => { setOpenTest(null); api.listTests().then(setTests).catch(() => {}); }}
        onPassed={() => load(selectedTags)}
      />
    </div>
  );
}
