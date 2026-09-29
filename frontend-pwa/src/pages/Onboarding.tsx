import { ArrowLeft, ArrowRight, BadgeCheck, BellRing, Building2, Check, GraduationCap, Loader2, Lock, Phone, Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, LEGAL_BASE_URL, type GroupInvite, type Profile, type University } from "../lib/api";
import { bindBackButton, canRequestPhone, haptic, requestPhone } from "../lib/max";
import Combobox, { useGeo } from "../components/Combobox";
import { useToast } from "../components/ui";

const STEPS = ["О себе", "Учёба", "Навыки"];

export default function Onboarding({ initialName, groupCode, onDone }: { initialName: string; groupCode: string | null; onDone: (p: Profile) => void }) {
  const toast = useToast();
  const regions = useGeo();
  const [step, setStep] = useState(-1); // -1 = welcome
  const [invite, setInvite] = useState<GroupInvite | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [name, setName] = useState(initialName === "Тестовый студент" ? "" : initialName);
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState("");
  const [university, setUniversity] = useState("");
  const [group, setGroup] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listSkills().then((s) => setAvailable(s.map((x) => x.name))).catch(() => {});
    api.universities().then(setUniversities).catch(() => {});
  }, []);

  useEffect(() => {
    if (!groupCode) return;
    api.groupInvite(groupCode).then(setInvite).catch((e) => setInviteError(e instanceof ApiError ? e.message : "Ссылка-приглашение недействительна"));
  }, [groupCode]);

  useEffect(() => bindBackButton(step >= 0 ? () => setStep((s) => s - 1) : null), [step]);

  const cities = useMemo(() => regions.find((r) => r.region === region)?.cities ?? [], [regions, region]);
  const uniMatches = universities.filter((u) => !university || u.name.toLowerCase().includes(university.trim().toLowerCase())).slice(0, 4);
  const exactUni = universities.some((u) => u.name.toLowerCase() === university.trim().toLowerCase());
  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  const canNext = step === 0 ? name.trim().length > 1 && phoneOk : step === 1 ? Boolean(invite) || (university.trim().length > 1 && region && city) : acceptTerms && acceptPrivacy;

  async function takePhone() {
    const value = await requestPhone();
    if (value) { setPhone(value); haptic.success(); } else toast("info", "Номер не получен — введите его вручную");
  }

  function toggle(skill: string) {
    haptic.select();
    setSelected((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  function addCustom() {
    const value = custom.trim();
    if (!value) return;
    if (!available.some((s) => s.toLowerCase() === value.toLowerCase())) setAvailable((prev) => [...prev, value]);
    if (!selected.some((s) => s.toLowerCase() === value.toLowerCase())) setSelected((prev) => [...prev, value]);
    setCustom("");
  }

  async function finish() {
    setBusy(true);
    try {
      const profile = await api.updateMe({
        name: name.trim(), phone: phone.trim(), contact_info: contact.trim(),
        university: invite ? invite.university : university.trim(), group: invite ? invite.group : group.trim(),
        region: invite ? invite.region : region, city: invite ? invite.city : city,
        group_code: invite ? groupCode : null, accept_terms: acceptTerms, accept_privacy: acceptPrivacy,
      });
      const results = await Promise.allSettled(selected.map((skill) => api.claimSkill(skill)));
      if (results.some((r) => r.status === "rejected")) toast("error", "Часть навыков не сохранилась — добавьте их в профиле.");
      haptic.success();
      onDone(profile);
    } catch (e) {
      haptic.error();
      toast("error", e instanceof ApiError ? e.message : "Не удалось сохранить профиль, попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  }

  if (step === -1) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-6">
        <div className="flex items-center gap-2"><img src="/logo-mark.svg" alt="" className="h-8 w-8" /><span className="font-extrabold tracking-tight">Практика<span className="text-blue-700">Плюс</span></span></div>
        <div className="relative mt-6 overflow-hidden rounded-[28px] bg-gradient-to-b from-blue-50 to-white">
          <div className="absolute inset-x-8 top-10 h-48 rounded-full bg-blue-200/50 blur-3xl" />
          <img src="/illustrations/student.webp" alt="" className="relative mx-auto h-72 w-auto object-contain pt-4 drop-shadow-xl" />
        </div>
        <h1 className="mt-6 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900">Стажировки, где важно, <span className="text-blue-700">что ты умеешь</span></h1>
        {invite ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
            <p className="flex items-center gap-2 font-bold"><GraduationCap className="h-5 w-5 shrink-0" />Приглашение от вуза</p>
            <p className="mt-1.5 leading-6">{invite.university}<br />Группа {invite.group}{invite.course ? `, ${invite.course} курс` : ""} · {invite.city}</p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3 text-sm text-slate-600">
            <li className="flex gap-3"><BadgeCheck className="h-5 w-5 shrink-0 text-blue-700" />Вуз подтверждает навыки — работодатель им доверяет</li>
            <li className="flex gap-3"><Sparkles className="h-5 w-5 shrink-0 text-blue-700" />Индекс соответствия показывает, где ты подходишь и чего не хватает</li>
            <li className="flex gap-3"><BellRing className="h-5 w-5 shrink-0 text-blue-700" />Задание и решение компании приходят прямо в чат MAX</li>
          </ul>
        )}
        {inviteError && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{inviteError} Можно зарегистрироваться самостоятельно.</p>}
        <button onClick={() => setStep(0)} className="btn-primary mt-auto w-full py-3.5 text-base">{invite ? `Присоединиться к группе ${invite.group}` : "Начать — 1 минута"}<ArrowRight className="h-5 w-5" /></button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep((s) => s - 1)} aria-label="Назад" className="rounded-xl p-2 text-slate-500 hover:bg-white"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex flex-1 gap-1.5">{STEPS.map((label, i) => <span key={label} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-blue-600" : "bg-slate-200"}`} />)}</div>
        <span className="w-12 text-right text-xs font-semibold text-slate-400">{step + 1}/{STEPS.length}</span>
      </div>

      {step === 0 && (
        <section className="mt-8 animate-fade-in space-y-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Как с вами связаться?</h1>
            <p className="mt-2 text-sm text-slate-500">Имя и телефон увидит компания, когда вы откликнетесь, — чтобы пригласить на собеседование.</p>
          </div>
          <label className="label">ФИО<input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Иван Петров" className="field" /></label>
          <label className="label">Телефон
            <div className="flex gap-2">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} inputMode="tel" placeholder="+7 900 000-00-00" className="field" />
              {canRequestPhone() && <button type="button" onClick={takePhone} className="btn-secondary mt-1.5 shrink-0 px-3" aria-label="Взять номер из MAX"><Phone className="h-4 w-4" /></button>}
            </div>
          </label>
          {canRequestPhone() && <p className="-mt-2 text-xs text-slate-400">Кнопка с трубкой подставит номер из MAX — с вашего разрешения.</p>}
          <label className="label">Username или e-mail <span className="font-normal text-slate-400">— необязательно</span><input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="@username" className="field" /></label>
        </section>
      )}

      {step === 1 && (
        <section className="mt-8 animate-fade-in space-y-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Где вы учитесь?</h1>
            <p className="mt-2 text-sm text-slate-500">{invite ? "Данные заполнены вузом по приглашению — менять их не нужно." : "Выберите вуз из списка — так куратор увидит профиль и сможет подтвердить навыки."}</p>
          </div>
          {invite ? (
            <div className="space-y-3">
              {[["Вуз", invite.university], ["Группа", invite.group], ["Регион", invite.region], ["Город", invite.city]].map(([label, value]) => (
                <div key={label} className="label">{label}<div className="field flex items-center justify-between bg-slate-50 text-slate-700"><span className="truncate">{value || "—"}</span><Lock className="h-4 w-4 shrink-0 text-slate-400" /></div></div>
              ))}
            </div>
          ) : (
            <>
              <label className="label">Вуз<input value={university} onChange={(e) => setUniversity(e.target.value)} maxLength={200} placeholder="Начните вводить название" className="field" /></label>
              {!exactUni && uniMatches.length > 0 && (
                <div className="-mt-2 space-y-1.5">
                  {uniMatches.map((u) => (
                    <button key={u.name} onClick={() => { setUniversity(u.name); haptic.select(); }} className="flex w-full items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 text-left text-sm ring-1 ring-slate-200 hover:ring-blue-300">
                      <Building2 className="h-4 w-4 shrink-0 text-blue-700" /><span className="min-w-0 flex-1 truncate font-medium text-slate-800">{u.name}</span><span className="shrink-0 text-[11px] text-emerald-700">на платформе</span>
                    </button>
                  ))}
                </div>
              )}
              {exactUni && <p className="-mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" />Куратор этого вуза уже на платформе</p>}
              <label className="label">Группа<input value={group} onChange={(e) => setGroup(e.target.value)} maxLength={50} placeholder="ИВТ-21-1" className="field" /></label>
              <Combobox label="Регион" value={region} options={regions.map((r) => r.region)} onChange={(v) => { setRegion(v); setCity(""); }} placeholder="Выберите регион" />
              <Combobox label="Город" value={city} options={cities} onChange={setCity} placeholder={region ? "Выберите город" : "Сначала выберите регион"} disabled={!region} />
            </>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="mt-8 animate-fade-in">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Что вы уже умеете?</h1>
          <p className="mt-2 text-sm text-slate-500">Отметьте технологии, с которыми работали. Они сразу учитываются в индексе, а после подтверждения вузом — засчитываются полностью.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {available.map((skill) => {
              const on = selected.includes(skill);
              return <button key={skill} aria-pressed={on} onClick={() => toggle(skill)} className={`inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-semibold transition ${on ? "bg-blue-700 text-white shadow-lift" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{on && <Check className="h-3.5 w-3.5" />}{skill}</button>;
            })}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); addCustom(); }} className="mt-3 flex gap-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={60} placeholder="Другой навык…" className="field mt-0" />
            <button type="submit" disabled={!custom.trim()} className="btn-secondary shrink-0 px-3.5" aria-label="Добавить навык"><Plus className="h-4 w-4" /></button>
          </form>
          <div className="mt-6 space-y-3 rounded-2xl bg-white p-4 text-[13px] leading-5 text-slate-600 ring-1 ring-slate-200">
            <label className="flex items-start gap-3"><input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" /><span>Принимаю <a href={`${LEGAL_BASE_URL}/offer`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">условия использования</a></span></label>
            <label className="flex items-start gap-3"><input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" /><span>Даю <a href={`${LEGAL_BASE_URL}/consent`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">согласие на обработку персональных данных</a> и ознакомлен(а) с <a href={`${LEGAL_BASE_URL}/privacy`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">политикой</a></span></label>
          </div>
        </section>
      )}

      <div className="mt-auto pt-8">
        {step < STEPS.length - 1 ? (
          <button onClick={() => { haptic.tap(); setStep((s) => s + 1); }} disabled={!canNext} className="btn-primary w-full py-3.5 text-base">Далее<ArrowRight className="h-5 w-5" /></button>
        ) : (
          <button onClick={finish} disabled={!canNext || busy} className="btn-primary w-full py-3.5 text-base">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{selected.length ? `Готово · навыков: ${selected.length}` : "Готово"}</button>
        )}
        {step === 0 && !phoneOk && name.trim().length > 1 && <p className="mt-2 text-center text-xs text-slate-400">Укажите телефон — по нему компания пригласит на собеседование</p>}
        {step === 2 && !canNext && <p className="mt-2 text-center text-xs text-slate-400">Отметьте оба согласия, чтобы продолжить</p>}
      </div>
    </div>
  );
}
