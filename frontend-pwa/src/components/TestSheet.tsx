import { ArrowLeft, ArrowRight, BadgeCheck, Check, ClipboardCheck, Handshake, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, type SkillTest, type TestResult } from "../lib/api";
import { haptic, setClosingConfirmation } from "../lib/max";
import { MatchRing, Sheet, Skeleton, useToast } from "./ui";

type Stage = "intro" | "questions" | "result";

export default function TestSheet({ testId, onClose, onPassed }: { testId: number | null; onClose: () => void; onPassed: () => void }) {
  const toast = useToast();
  const [test, setTest] = useState<SkillTest | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (!testId) return;
    setTest(null); setStage("intro"); setIndex(0); setResult(null);
    api.getTest(testId)
      .then((t) => { setTest(t); setAnswers(new Array(t.questions?.length ?? 0).fill(null)); })
      .catch((e) => { toast("error", e instanceof ApiError ? e.message : "Тест недоступен"); onClose(); });
  }, [testId, onClose, toast]);

  useEffect(() => { setClosingConfirmation(stage === "questions"); return () => setClosingConfirmation(false); }, [stage]);

  if (!testId) return null;
  const questions = test?.questions ?? [];
  const current = questions[index];
  const attemptsLeft = test ? test.max_attempts - (test.attempts_used ?? 0) : 0;

  async function submit() {
    if (!test) return;
    setBusy(true);
    try {
      const r = await api.submitTest(test.test_id, answers.map((a) => a ?? -1));
      setResult(r);
      setStage("result");
      if (r.passed) { haptic.success(); onPassed(); } else haptic.warning();
    } catch (e) {
      haptic.error();
      toast("error", e instanceof ApiError ? e.message : "Не удалось отправить ответы");
    } finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={onClose} title={test?.title ?? "Тест"}>
      <div className="px-5 pb-6">
        {!test && <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-32" /></div>}

        {test && stage === "intro" && (
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800"><ClipboardCheck className="h-3.5 w-3.5" />Тест навыка «{test.skill}»</span>
            <h2 className="mt-3 text-xl font-bold leading-tight text-slate-900">{test.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{test.description}</p>
            {test.partner_name && <p className="mt-3 flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800"><Handshake className="h-4 w-4 shrink-0" />Составлен вузом совместно с «{test.partner_name}»</p>}
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[11px] text-slate-500">Вопросов</dt><dd className="mt-0.5 text-lg font-bold tabular">{test.questions_count}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[11px] text-slate-500">Проходной</dt><dd className="mt-0.5 text-lg font-bold tabular">{test.pass_score}%</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[11px] text-slate-500">Попыток</dt><dd className="mt-0.5 text-lg font-bold tabular">{attemptsLeft}</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-slate-500">После успешной сдачи навык подтверждается от имени вуза — индекс соответствия пересчитается сразу, бот пришлёт подходящие стажировки.</p>
            {test.passed
              ? <p className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-bold text-emerald-800"><BadgeCheck className="h-5 w-5" />Тест сдан, навык подтверждён</p>
              : <button onClick={() => setStage("questions")} disabled={attemptsLeft <= 0} className="btn-primary mt-5 w-full py-3.5">{attemptsLeft <= 0 ? "Попытки закончились" : "Начать тест"}</button>}
          </div>
        )}

        {test && stage === "questions" && current && (
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Вопрос {index + 1} из {questions.length}</span><span>{test.skill}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
            <h3 className="mt-5 text-lg font-bold leading-snug text-slate-900">{current.text}</h3>
            <div className="mt-4 space-y-2" role="radiogroup">
              {current.options.map((option, i) => {
                const chosen = answers[index] === i;
                return (
                  <button key={i} role="radio" aria-checked={chosen} onClick={() => { haptic.select(); setAnswers((a) => a.map((v, k) => (k === index ? i : v))); }} className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${chosen ? "bg-blue-50 text-blue-900 ring-2 ring-blue-600" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${chosen ? "bg-blue-600 text-white" : "ring-1 ring-slate-300"}`}>{chosen && <Check className="h-3 w-3" />}</span>
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
              <button onClick={() => (index === 0 ? setStage("intro") : setIndex((i) => i - 1))} className="btn-secondary px-4" aria-label="Назад"><ArrowLeft className="h-4 w-4" /></button>
              {index < questions.length - 1
                ? <button onClick={() => setIndex((i) => i + 1)} disabled={answers[index] === null} className="btn-primary">Далее<ArrowRight className="h-4 w-4" /></button>
                : <button onClick={submit} disabled={busy || answers.some((a) => a === null)} className="btn-primary">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Завершить тест</button>}
            </div>
          </div>
        )}

        {test && stage === "result" && result && (
          <div className="text-center">
            <div className="flex justify-center"><MatchRing score={result.score} size={112} /></div>
            <h2 className={`mt-4 text-xl font-bold ${result.passed ? "text-emerald-700" : "text-slate-900"}`}>{result.passed ? "Тест сдан!" : "Пока не хватило"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {result.passed
                ? <>Навык «{result.skill}» подтверждён вузом{test.partner_name ? ` совместно с «${test.partner_name}»` : ""}. Индекс соответствия уже пересчитан.</>
                : <>Нужно {test.pass_score}%. Осталось попыток: {result.attempts_left}. Повторите тему и попробуйте снова.</>}
            </p>
            <ol className="mt-5 space-y-1.5 text-left">
              {questions.map((q, i) => (
                <li key={q.id} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {result.correct[i] ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}{q.text}
                </li>
              ))}
            </ol>
            <button onClick={onClose} className="btn-primary mt-6 w-full">Готово</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
