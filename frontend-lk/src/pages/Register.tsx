import { Building2, GraduationCap, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { humanError, LEGAL_BASE_URL, register } from "../lib/api";
import AuthShell from "../components/AuthShell";
import { PlacePicker } from "../components/ui";

export default function Register({ onRegistered }: { onRegistered: () => void }) {
  const [role, setRole] = useState<"hr" | "curator">("hr");
  const [org, setOrg] = useState("");
  const [person, setPerson] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const valid = org.trim().length > 1 && person.trim().length > 1 && email.trim() && password.length >= 8 && acceptTerms && acceptPrivacy && region && city;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await register(role === "hr"
        ? { role, name: org.trim(), person_name: person.trim(), position: position.trim() || "HR-директор", phone: phone.trim(), email: email.trim(), password, region, city, accept_terms: acceptTerms, accept_privacy: acceptPrivacy }
        : { role, name: person.trim(), university: org.trim(), position: position.trim() || "Администратор вуза", phone: phone.trim(), email: email.trim(), password, region, city, accept_terms: acceptTerms, accept_privacy: acceptPrivacy });
      onRegistered();
    } catch (err) {
      setError(humanError(err, "Не удалось зарегистрироваться"));
    } finally {
      setBusy(false);
    }
  }

  const roleButton = (value: "hr" | "curator", label: string, Icon: typeof Building2) => (
    <button type="button" onClick={() => setRole(value)} aria-pressed={role === value} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${role === value ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
      <Icon className="h-4 w-4" />{label}
    </button>
  );

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Регистрация организации</h2>
      <p className="mt-1.5 text-sm text-slate-500">Вы станете владельцем аккаунта и сможете пригласить {role === "hr" ? "рекрутеров" : "кураторов"}.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">{roleButton("hr", "Компания", Building2)}{roleButton("curator", "Вуз", GraduationCap)}</div>
        <label className="label">{role === "hr" ? "Название компании" : "Вуз (полное название)"}<input value={org} onChange={(e) => setOrg(e.target.value)} maxLength={200} placeholder={role === "hr" ? "ООО «Связь-Интеграция»" : "Северо-Кавказский федеральный университет (СКФУ)"} className="field" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">Ваше ФИО<input value={person} onChange={(e) => setPerson(e.target.value)} maxLength={120} placeholder="Анна Ковалева" className="field" /></label>
          <label className="label">Должность<input value={position} onChange={(e) => setPosition(e.target.value)} maxLength={80} placeholder={role === "hr" ? "HR-директор" : "Руководитель центра карьеры"} className="field" /></label>
        </div>
        <div className="grid grid-cols-2 gap-3"><PlacePicker required region={region} city={city} onChange={(r, c) => { setRegion(r); setCity(c); }} /></div>
        <label className="label">Рабочий телефон<input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} inputMode="tel" placeholder="+7 900 000-00-00" className="field" /></label>
        <label className="label">Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" /></label>
        <label className="label">Пароль <span className="font-normal text-slate-400">— от 8 символов</span><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" /></label>
        <div className="space-y-2.5 text-xs leading-5 text-slate-600">
          <label className="flex items-start gap-2.5"><input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" /><span>Принимаю <a href={`${LEGAL_BASE_URL}/offer`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">условия использования</a></span></label>
          <label className="flex items-start gap-2.5"><input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" /><span>Даю <a href={`${LEGAL_BASE_URL}/consent`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">согласие на обработку данных</a> и ознакомлен(а) с <a href={`${LEGAL_BASE_URL}/privacy`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">политикой</a></span></label>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy || !valid} className="btn-primary w-full py-3">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Создаём кабинет…" : "Создать кабинет"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Уже есть аккаунт? <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800">Войти</Link></p>
    </AuthShell>
  );
}
