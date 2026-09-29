import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api, ApiError, LEGAL_BASE_URL, type Profile } from "../lib/api";

export default function ConsentRenewal({ profile, onAccepted }: { profile: Profile; onAccepted: (profile: Profile) => void }) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    try {
      onAccepted(await api.updateMe({ name: profile.name, phone: profile.phone, contact_info: profile.contact_info, university: profile.university, group: profile.group, region: profile.region, city: profile.city, accept_terms: true, accept_privacy: true }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить согласие. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-8">
      <section className="card w-full max-w-md p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck className="h-6 w-6" /></span>
        <h1 className="mt-5 text-xl font-bold text-slate-900">Обновились документы</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Чтобы продолжить, подтвердите актуальные условия и правила обработки данных.</p>
        <div className="mt-5 space-y-4 text-sm leading-5 text-slate-700">
          <label className="flex items-start gap-3"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" /><span>Принимаю <a href={`${LEGAL_BASE_URL}/offer`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">условия использования</a></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" /><span>Даю <a href={`${LEGAL_BASE_URL}/consent`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">согласие на обработку данных</a> и ознакомлен(а) с <a href={`${LEGAL_BASE_URL}/privacy`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">политикой</a></span></label>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
        <button onClick={accept} disabled={busy || !terms || !privacy} className="btn-primary mt-6 w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Принять и продолжить</button>
      </section>
    </div>
  );
}
