import { Building2, ClipboardCheck, ClipboardList, Loader2, MapPin, Share2 } from "lucide-react";
import { miniappLink, type SkillTest, type Vacancy } from "../lib/api";
import { haptic, shareToMax } from "../lib/max";
import { CHIP_LEGEND, MatchRing, Sheet, SkillChip, scoreTone, useToast } from "./ui";
import { StatusPill } from "./StatusPill";

export default function VacancySheet({ vacancy, onClose, onApply, busy, onGoToApplications, testsBySkill = {}, onOpenTest }: {
  vacancy: Vacancy | null;
  onClose: () => void;
  onApply: (v: Vacancy) => void;
  busy: boolean;
  onGoToApplications: () => void;
  testsBySkill?: Record<string, SkillTest>;
  onOpenTest?: (testId: number) => void;
}) {
  const toast = useToast();
  if (!vacancy) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const match = vacancy.match;
  const score = match?.score ?? 0;
  const tone = scoreTone(score);
  const core = match?.items.filter((i) => i.is_core) ?? [];
  const optional = match?.items.filter((i) => !i.is_core) ?? [];
  const closable = (match?.items ?? []).filter((i) => i.status !== "verified" && testsBySkill[i.skill.toLowerCase()] && !testsBySkill[i.skill.toLowerCase()].passed).map((i) => testsBySkill[i.skill.toLowerCase()]);

  async function share() {
    const result = await shareToMax(`Стажировка «${vacancy!.title}» — ${vacancy!.company_name}. Посмотри в ПрактикаПлюс:`, miniappLink(`vac_${vacancy!.vacancy_id}`));
    if (result === "copied") toast("success", "Ссылка скопирована — отправьте её одногруппнику в MAX");
    else if (result === "failed") toast("error", "Не удалось поделиться. Попробуйте ещё раз.");
    else haptic.success();
  }

  return (
    <Sheet open onClose={onClose} title={vacancy.title}>
      <div className="px-5 pb-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Building2 className="h-3.5 w-3.5" />{vacancy.company_name}</p>
            <h2 className="mt-1 text-xl font-bold leading-tight text-slate-900">{vacancy.title}</h2>
            {(vacancy.city || vacancy.region) && <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{[vacancy.city, vacancy.region].filter(Boolean).join(", ")}</p>}
          </div>
          <MatchRing score={score} potential={match?.potential} size={84} />
        </div>

        <section className={`mt-5 rounded-2xl ${tone.bg} p-4`}>
          <p className={`text-sm font-bold ${tone.text}`}>{tone.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Учитываются все ваши навыки: подтверждённые вузом — полностью, «на усмотрение работодателя» — на 75%, заявленные и смежные — наполовину. Ключевые требования весят ×2, желательные ×1.
            {match && <> Подтверждено вузом: <b>{Math.round(match.verified_score)}%</b>.</>}
            {match && match.potential > match.score && <> После проверки заявленных навыков индекс станет <b>{Math.round(match.potential)}%</b>.</>}
          </p>
          {core.length > 0 && <>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Ключевые · вес 2</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{core.map((item) => <SkillChip key={item.skill} item={item} compact />)}</div>
          </>}
          {optional.length > 0 && <>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Желательные · вес 1</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{optional.map((item) => <SkillChip key={item.skill} item={item} compact />)}</div>
          </>}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {(["verified", "employer", "claimed", "related", "missing"] as const).map((s) => <span key={s} className="inline-flex items-center gap-1">{CHIP_LEGEND[s].icon}{CHIP_LEGEND[s].hint}</span>)}
          </div>
          {match?.items.some((i) => i.status === "related") && (
            <p className="mt-2 text-[11px] text-slate-500">Смежные: {match.items.filter((i) => i.status === "related").map((i) => `${i.skill} ← ${i.via}`).join(", ")}</p>
          )}
        </section>

        {closable.length > 0 && onOpenTest && (
          <section className="mt-4 rounded-2xl border border-blue-200 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><ClipboardCheck className="h-4 w-4 text-blue-700" />Подтвердите навык тестом вуза</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Сдайте тест — навык подтвердится сразу, индекс вырастет.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {closable.map((t) => <button key={t.test_id} onClick={() => onOpenTest(t.test_id)} className="rounded-full bg-blue-600 px-3.5 py-2 text-xs font-bold text-white active:scale-[.98]">Тест: {t.skill}</button>)}
            </div>
          </section>
        )}

        <section className="mt-5">
          <h3 className="text-sm font-bold text-slate-900">О стажировке</h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-600">{vacancy.description || "Компания не добавила описание."}</p>
        </section>

        {vacancy.has_test_task && (
          <section className="mt-4 flex gap-3 rounded-2xl border border-slate-200 p-4">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <p className="text-sm leading-6 text-slate-600"><b className="text-slate-900">Короткое тестовое задание.</b> Придёт в чат с ботом MAX сразу после отклика. Ответить можно сообщением в чате или здесь, во вкладке «Отклики».</p>
          </section>
        )}

        <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
          <button onClick={share} className="btn-secondary px-4" aria-label="Поделиться в MAX"><Share2 className="h-4 w-4" /></button>
          {vacancy.my_application_status ? (
            <button onClick={onGoToApplications} className="btn-secondary justify-between"><span>Мой отклик</span><StatusPill status={vacancy.my_application_status} /></button>
          ) : (
            <button onClick={() => onApply(vacancy)} disabled={busy} className="btn-primary">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Отправляем…" : "Откликнуться"}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
