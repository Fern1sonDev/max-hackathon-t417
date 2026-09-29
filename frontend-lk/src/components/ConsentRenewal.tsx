import { useState } from "react";
import { ApiError, api, LEGAL_BASE_URL, type Profile } from "../lib/api";

export default function ConsentRenewal({ profile, onAccepted }: { profile: Profile; onAccepted: (profile: Profile) => void }) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const updated = await api.updateMe({
        role: profile.role,
        name: profile.name,
        contact_info: profile.contact_info,
        phone: profile.phone,
        university: profile.university,
        group: profile.group,
        region: profile.region,
        city: profile.city,
        accept_terms: true,
        accept_privacy: true,
      });
      onAccepted(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить согласие. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg card p-7">
        <img src="/logo-mark.svg" alt="ПрактикаПлюс" className="h-12 w-12" />
        <h1 className="mt-6 text-2xl font-bold text-slate-950">Обновились документы</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Чтобы продолжить пользоваться кабинетом, ознакомьтесь с актуальными условиями и правилами обработки персональных данных.</p>
        <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
          <label className="flex items-start gap-3"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-700" /><span>Принимаю <a href={`${LEGAL_BASE_URL}/offer`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">условия использования</a>.</span></label>
          <label className="flex items-start gap-3"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-700" /><span>Даю согласие на обработку персональных данных и ознакомлен(а) с <a href={`${LEGAL_BASE_URL}/consent`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">согласием</a> и <a href={`${LEGAL_BASE_URL}/privacy`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">политикой</a>.</span></label>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
        <button onClick={accept} disabled={busy || !terms || !privacy} className="mt-7 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Сохраняем…" : "Принять и продолжить"}</button>
      </section>
    </main>
  );
}
