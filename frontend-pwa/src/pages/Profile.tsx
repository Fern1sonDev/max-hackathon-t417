import { Award, BadgeCheck, Check, ChevronDown, ClipboardCheck, Clock3, Copy, Eye, Globe, Handshake, Loader2, Lock, Phone, Plus, RotateCcw, Save, Share2, Trash2, Trophy, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, LEGAL_BASE_URL, type Profile as ProfileData, type SkillTest, type StudentProgress, type StudentSkill } from "../lib/api";
import TestSheet from "../components/TestSheet";
import Combobox, { useGeo } from "../components/Combobox";
import { canRequestPhone, haptic, requestPhone, shareToMax } from "../lib/max";
import { Avatar, Confirm, ErrorBox, Sheet, Skeleton, useToast } from "../components/ui";

function SkillGroup({ title, tone, items, render }: { title: string; tone: string; items: StudentSkill[]; render: (s: StudentSkill) => ReactNode }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className={`text-[11px] font-bold uppercase tracking-wide ${tone}`}>{title} · {items.length}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{items.map(render)}</div>
    </div>
  );
}

export default function Profile({ profile, onProfile, onReset }: { profile: ProfileData; onProfile: (p: ProfileData) => void; onReset: () => void }) {
  const toast = useToast();
  const regions = useGeo();
  const [skills, setSkills] = useState<StudentSkill[] | null>(null);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [error, setError] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [skillBusy, setSkillBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState({ name: profile.name, phone: profile.phone, university: profile.university, group: profile.group, region: profile.region, city: profile.city, contact_info: profile.contact_info });
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [tests, setTests] = useState<SkillTest[] | null>(null);
  const [openTest, setOpenTest] = useState<number | null>(null);
  const [comment, setComment] = useState<StudentSkill | null>(null);

  function load() {
    setError("");
    Promise.all([api.mySkills(), api.listSkills(), api.myProgress()])
      .then(([mine, all, summary]) => { setSkills(mine); setCatalog(all.map((s) => s.name)); setProgress(summary); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить профиль"));
    api.listTests().then(setTests).catch(() => setTests([]));
  }
  useEffect(load, []);

  const owned = useMemo(() => new Set((skills ?? []).map((s) => s.name.toLowerCase())), [skills]);
  const suggestions = catalog.filter((n) => !owned.has(n.toLowerCase()) && (!newSkill || n.toLowerCase().includes(newSkill.trim().toLowerCase()))).slice(0, 14);
  const by = (status: string) => (skills ?? []).filter((s) => s.status === status);
  const cities = regions.find((r) => r.region === draft.region)?.cities ?? [];

  async function refreshPoints() {
    const summary = await api.myProgress().catch(() => null);
    if (summary) { setProgress(summary); onProfile({ ...profile, points: summary.points }); }
  }

  async function addSkill(name: string) {
    const value = name.trim();
    if (!value) return;
    setSkillBusy(value);
    try {
      const skill = await api.claimSkill(value);
      setSkills((items) => (items && items.some((s) => s.skill_id === skill.skill_id) ? items : [...(items ?? []), skill]));
      setNewSkill("");
      haptic.tap();
      await refreshPoints();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Не удалось добавить навык");
    } finally { setSkillBusy(null); }
  }

  async function removeSkill(skill: StudentSkill) {
    setSkillBusy(skill.name);
    try {
      await api.removeSkill(skill.skill_id);
      setSkills((items) => items && items.filter((s) => s.skill_id !== skill.skill_id));
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Не удалось удалить навык");
    } finally { setSkillBusy(null); }
  }

  async function shareCertificate(skill: StudentSkill) {
    try {
      const { url } = await api.myCertificateLink(skill.skill_id);
      const result = await shareToMax(`Мой навык «${skill.name}» подтверждён вузом — цифровой сертификат ПрактикаПлюс:`, url);
      if (result === "copied") toast("success", "Ссылка на сертификат скопирована");
      if (result === "failed") toast("error", "Не удалось поделиться сертификатом");
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Сертификат недоступен");
    }
  }

  async function togglePortfolio(isPublic: boolean, showContact = profile.portfolio_show_contact) {
    try {
      const updated = await api.setPortfolio(isPublic, showContact);
      onProfile({ ...updated, points: profile.points });
      haptic.select();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Не удалось изменить визитку");
    }
  }

  async function sharePortfolio() {
    if (!profile.portfolio_url) return;
    const result = await shareToMax(`${profile.name} — визитка студента: навыки, подтверждённые вузом`, profile.portfolio_url);
    if (result === "copied") toast("success", "Ссылка на визитку скопирована");
  }

  async function takePhone() {
    const phone = await requestPhone();
    if (phone) { setDraft((d) => ({ ...d, phone })); haptic.success(); } else toast("info", "Номер не получен — можно ввести вручную");
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await api.updateMe({ ...draft, accept_terms: false, accept_privacy: false });
      onProfile({ ...updated, points: profile.points });
      haptic.success();
      toast("success", "Профиль сохранён");
      setEditOpen(false);
      await refreshPoints();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Не удалось сохранить профиль");
    } finally { setSaving(false); }
  }

  async function toggleVisibility() {
    try {
      const updated = await api.setStudentDiscoverable(!profile.student_directory_opt_in);
      onProfile({ ...updated, points: profile.points });
      haptic.select();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Не удалось изменить видимость");
    }
  }

  async function reset() {
    setResetting(true);
    try {
      const result = await api.resetProfile();
      haptic.warning();
      toast("success", `Профиль сброшен: навыков — ${result.removed_skills}, откликов — ${result.removed_applications}`);
      setConfirmReset(false);
      onReset();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Не удалось сбросить профиль");
      setResetting(false);
    }
  }

  const levelProgress = progress ? Math.min(100, ((progress.points % 50) / 50) * 100) : 0;
  const chip = (cls: string, icon: ReactNode, s: StudentSkill, extra?: ReactNode) => (
    <span key={s.skill_id} className={`inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      <button onClick={() => (s.comment || s.reviewed_by ? setComment(s) : undefined)} className="inline-flex items-center gap-1">{icon}{s.name}</button>
      {extra}
    </span>
  );

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex items-center gap-4">
          <Avatar name={profile.name} size={60} src={profile.avatar_url} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900">{profile.name}</h1>
            <p className="truncate text-sm text-slate-500">{[profile.university.split(" (")[0], profile.group].filter(Boolean).join(" · ") || "Вуз не указан"}</p>
            {profile.group_locked && <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Lock className="h-3 w-3" />Группа подтверждена вузом</p>}
          </div>
        </div>
        {progress ? (
          <div className="mt-5 rounded-2xl bg-slate-900 p-4 text-white">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-bold"><Trophy className="h-4 w-4 text-amber-300" />Уровень {progress.level}</p>
              <p className="text-sm text-slate-300 tabular">{progress.points} баллов</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all" style={{ width: `${levelProgress}%` }} /></div>
            <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
              {progress.achievements.map((a) => (
                <div key={a.key} className={`w-36 shrink-0 rounded-xl p-3 ${a.earned ? "bg-emerald-400/15 ring-1 ring-emerald-300/30" : "bg-white/5"}`}>
                  <p className="flex items-center gap-1.5 text-xs font-semibold">{a.earned ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Award className="h-3.5 w-3.5 text-slate-400" />}{a.title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">{a.description}</p>
                  <p className="mt-1.5 text-[11px] font-semibold text-slate-300 tabular">{a.progress}/{a.goal}</p>
                </div>
              ))}
            </div>
          </div>
        ) : !error && <Skeleton className="mt-5 h-32" />}
      </section>

      {error && <ErrorBox message={error} onRetry={load} />}

      <section className="card p-5">
        <h2 className="font-bold text-slate-900">Навыки</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Все навыки учитываются в индексе: подтверждённые вузом — полностью, «на усмотрение работодателя» — на 75%, заявленные — наполовину. Нажмите на навык, чтобы увидеть комментарий вуза.</p>
        {skills === null ? <Skeleton className="mt-4 h-20" /> : <>
          <SkillGroup title="Подтверждены вузом" tone="text-emerald-700" items={by("verified")} render={(s) => chip("bg-emerald-50 text-emerald-800 ring-emerald-200", <BadgeCheck className="h-3.5 w-3.5" />, s,
            <button onClick={() => shareCertificate(s)} aria-label={`Поделиться сертификатом ${s.name}`} className="rounded-full p-1 hover:bg-emerald-100"><Share2 className="h-3 w-3" /></button>)} />
          <SkillGroup title="На усмотрение работодателя" tone="text-violet-700" items={by("employer_review")} render={(s) => chip("bg-violet-50 text-violet-800 ring-violet-200", <Handshake className="h-3.5 w-3.5" />, s)} />
          <SkillGroup title="Заявлены, ждут проверки" tone="text-blue-700" items={by("claimed")} render={(s) => chip("bg-blue-50 text-blue-800 ring-blue-200", <Clock3 className="h-3.5 w-3.5" />, s,
            <button onClick={() => removeSkill(s)} disabled={skillBusy === s.name} aria-label={`Удалить навык ${s.name}`} className="rounded-full p-1 text-blue-500 hover:bg-blue-100 hover:text-rose-600"><Trash2 className="h-3 w-3" /></button>)} />
          <SkillGroup title="Не подтверждены вузом" tone="text-slate-500" items={by("rejected")} render={(s) => chip("bg-slate-50 text-slate-500 ring-slate-200 line-through decoration-slate-300", <XCircle className="h-3.5 w-3.5" />, s,
            <button onClick={() => removeSkill(s)} aria-label={`Удалить навык ${s.name}`} className="rounded-full p-1 hover:bg-slate-100"><Trash2 className="h-3 w-3" /></button>)} />
          {skills.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Навыков пока нет — добавьте то, с чем уже работали.</p>}
          <form onSubmit={(e) => { e.preventDefault(); addSkill(newSkill); }} className="mt-4 flex gap-2">
            <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} maxLength={60} placeholder="Найти или добавить навык" className="field mt-0" aria-label="Новый навык" />
            <button type="submit" disabled={!newSkill.trim() || Boolean(skillBusy)} className="btn-primary shrink-0 px-3.5" aria-label="Добавить навык">{skillBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button>
          </form>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {suggestions.map((name) => <button key={name} onClick={() => addSkill(name)} disabled={Boolean(skillBusy)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:border-blue-400 hover:text-blue-700"><Plus className="h-3 w-3" />{name}</button>)}
          </div>
        </>}
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><ClipboardCheck className="h-5 w-5 text-blue-700" />Тесты от вуза</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Тесты кафедры, составленные вместе с работодателями. Сдали — навык подтверждён сразу.</p>
        {tests === null ? <Skeleton className="mt-4 h-16" /> : tests.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Для вашего вуза тестов пока нет — навыки подтверждает куратор.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {tests.map((t) => (
              <li key={t.test_id}>
                <button onClick={() => setOpenTest(t.test_id)} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-blue-50">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.passed ? "bg-emerald-100 text-emerald-700" : "bg-white text-blue-700 ring-1 ring-slate-200"}`}>{t.passed ? <BadgeCheck className="h-5 w-5" /> : <ClipboardCheck className="h-5 w-5" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{t.title}</span>
                    <span className="block truncate text-xs text-slate-500">{t.skill} · {t.questions_count} вопр. · от {t.pass_score}%{t.partner_name ? ` · с «${t.partner_name}»` : ""}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${t.passed ? "bg-emerald-50 text-emerald-700" : "bg-blue-600 text-white"}`}>{t.passed ? "сдан" : "пройти"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900">Визитка для работодателя</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Публичная страница с навыками, подтверждёнными вузом, сертификатами и пройденными тестами. Отправьте ссылку в резюме или письме.</p>
          </div>
          <label className="relative mt-0.5 shrink-0"><input type="checkbox" role="switch" aria-label="Публичная визитка" checked={profile.portfolio_public} onChange={() => togglePortfolio(!profile.portfolio_public)} className="peer sr-only" />
            <span aria-hidden className="block h-6 w-11 rounded-full bg-slate-200 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-blue-600 peer-checked:after:translate-x-5" /></label>
        </div>
        {profile.portfolio_public && profile.portfolio_url && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input readOnly value={profile.portfolio_url} className="field mt-0 bg-slate-50 font-mono text-xs text-slate-500" aria-label="Ссылка на визитку" />
              <button onClick={() => navigator.clipboard?.writeText(profile.portfolio_url).then(() => toast("success", "Ссылка скопирована"))} className="btn-secondary shrink-0 px-3" aria-label="Скопировать"><Copy className="h-4 w-4" /></button>
              <button onClick={sharePortfolio} className="btn-primary shrink-0 px-3" aria-label="Поделиться в MAX"><Share2 className="h-4 w-4" /></button>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={profile.portfolio_show_contact} onChange={(e) => togglePortfolio(true, e.target.checked)} className="h-4 w-4 accent-blue-700" />Показывать контакт на визитке</label>
          </div>
        )}
      </section>

      <section className="card">
        <button onClick={() => setEditOpen((v) => !v)} aria-expanded={editOpen} className="flex w-full items-center justify-between p-5 text-left">
          <span><span className="block font-bold text-slate-900">Данные профиля</span><span className="text-xs text-slate-500">Телефон увидит компания, когда вы откликнетесь</span></span>
          <ChevronDown className={`h-5 w-5 text-slate-400 transition ${editOpen ? "rotate-180" : ""}`} />
        </button>
        {editOpen && (
          <div className="space-y-3 border-t border-slate-100 p-5">
            <label className="label">ФИО<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} className="field" /></label>
            <label className="label">Телефон
              <div className="flex gap-2"><input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} maxLength={40} inputMode="tel" placeholder="+7 900 000-00-00" className="field" />
                {canRequestPhone() && <button type="button" onClick={takePhone} className="btn-secondary mt-1.5 shrink-0 px-3" aria-label="Взять номер из MAX"><Phone className="h-4 w-4" /></button>}</div>
            </label>
            <label className="label">Username или e-mail<input value={draft.contact_info} onChange={(e) => setDraft({ ...draft, contact_info: e.target.value })} maxLength={120} placeholder="@username" className="field" /></label>
            {profile.group_locked ? (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><p className="flex items-center gap-1.5 font-semibold text-slate-800"><Lock className="h-3.5 w-3.5" />Заполнено вузом по приглашению группы</p><p className="mt-1">{profile.university} · {profile.group} · {profile.city}</p></div>
            ) : <>
              <label className="label">Вуз<input value={draft.university} onChange={(e) => setDraft({ ...draft, university: e.target.value })} maxLength={200} className="field" /></label>
              <label className="label">Группа<input value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} maxLength={50} className="field" /></label>
              <Combobox label="Регион" value={draft.region} options={regions.map((r) => r.region)} onChange={(v) => setDraft({ ...draft, region: v, city: "" })} />
              <Combobox label="Город" value={draft.city} options={cities} onChange={(v) => setDraft({ ...draft, city: v })} disabled={!draft.region} placeholder={draft.region ? "Выберите город" : "Сначала регион"} />
            </>}
            <button onClick={saveProfile} disabled={saving || !draft.name.trim()} className="btn-primary w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить</button>
          </div>
        )}
      </section>

      <section className="card p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <span className="min-w-0 flex-1"><span className="block font-bold text-slate-900">Видимость в каталоге</span><span className="mt-1 block text-xs leading-5 text-slate-500">Работодатели найдут ваш профиль в каталоге, если вуз его открыл. Отклики видны компании всегда.</span></span>
          <input type="checkbox" role="switch" checked={profile.student_directory_opt_in} onChange={toggleVisibility} className="peer sr-only" />
          <span aria-hidden className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-200 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
        </label>
      </section>

      <section className="card border-rose-100 p-5">
        <h2 className="font-bold text-slate-900">Начать заново</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Полный сброс: удалятся навыки, отклики, ответы и статусы; вы снова пройдёте регистрацию. То же делает команда /reset в чате с ботом.</p>
        {profile.user_id.startsWith("demo-")
          ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Это общий демо-профиль для проверяющих — его сброс отключён. Откройте приложение под своим аккаунтом MAX, чтобы пройти сценарий с нуля.</p>
          : <button onClick={() => setConfirmReset(true)} className="btn-secondary mt-4 w-full border-rose-200 text-rose-700 hover:bg-rose-50"><RotateCcw className="h-4 w-4" />Сбросить профиль</button>}
      </section>

      <p className="px-2 pb-2 text-center text-[11px] leading-5 text-slate-400">
        <a href={`${LEGAL_BASE_URL}/offer`} target="_blank" rel="noreferrer" className="underline">Условия</a> · <a href={`${LEGAL_BASE_URL}/privacy`} target="_blank" rel="noreferrer" className="underline">Политика данных</a> · <a href={`${LEGAL_BASE_URL}/consent`} target="_blank" rel="noreferrer" className="underline">Согласие</a>
      </p>

      <TestSheet testId={openTest} onClose={() => { setOpenTest(null); load(); }} onPassed={() => { refreshPoints(); }} />
      <Sheet open={Boolean(comment)} onClose={() => setComment(null)} title={comment?.name}>
        <div className="px-6 pb-6">
          <h2 className="text-lg font-bold text-slate-900">{comment?.name}</h2>
          {comment?.comment && <p className="mt-3 rounded-2xl bg-slate-50 p-3.5 text-sm leading-6 text-slate-700">«{comment.comment}»</p>}
          {comment?.reviewed_by && <p className="mt-2 text-xs text-slate-500">Проверил(а): {comment.reviewed_by}</p>}
          <button onClick={() => setComment(null)} className="btn-primary mt-5 w-full">Понятно</button>
        </div>
      </Sheet>
      <Confirm open={confirmReset} title="Сбросить профиль?" text="Удалятся все навыки, отклики, ответы на задания и статусы. Действие нельзя отменить." confirmLabel="Сбросить" danger busy={resetting} onConfirm={reset} onCancel={() => setConfirmReset(false)} />
    </div>
  );
}
