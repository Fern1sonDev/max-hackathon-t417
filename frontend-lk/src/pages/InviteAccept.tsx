import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { acceptInvite, api, humanError, LEGAL_BASE_URL, type InvitePublic } from "../lib/api";
import AuthShell from "../components/AuthShell";

export default function InviteAccept({ onAccepted }: { onAccepted: () => Promise<void> | void }) {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InvitePublic | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getInvite(token).then((i) => { setInvite(i); setName(i.name); }).catch((e) => setLoadError(humanError(e, "Приглашение недоступно")));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await acceptInvite(token, { name: name.trim(), password, accept_terms: terms, accept_privacy: privacy });
      await onAccepted();
      navigate("/", { replace: true });
    } catch (err) {
      setError(humanError(err, "Не удалось принять приглашение"));
    } finally { setBusy(false); }
  }

  return (
    <AuthShell>
      {loadError ? (
        <>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Приглашение недоступно</h2>
          <p className="mt-2 text-sm text-slate-500">{loadError}</p>
          <Link to="/login" className="btn-secondary mt-6 w-full">Ко входу</Link>
        </>
      ) : !invite ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-700" /> : (
        <>
          <p className="text-sm font-semibold text-blue-700">{invite.role === "hr" ? "Команда работодателя" : "Команда вуза"}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Вас пригласили в «{invite.org_name}»</h2>
          <p className="mt-1.5 text-sm text-slate-500">Роль: {invite.position}. Вход — по email <b className="text-slate-700">{invite.email}</b>.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="label">ФИО<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="field" /></label>
            <label className="label">Придумайте пароль <span className="font-normal text-slate-400">— от 8 символов</span><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" /></label>
            <div className="space-y-2.5 text-xs leading-5 text-slate-600">
              <label className="flex items-start gap-2.5"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" /><span>Принимаю <a href={`${LEGAL_BASE_URL}/offer`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">условия использования</a></span></label>
              <label className="flex items-start gap-2.5"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" /><span>Даю <a href={`${LEGAL_BASE_URL}/consent`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">согласие на обработку данных</a></span></label>
            </div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={busy || name.trim().length < 2 || password.length < 8 || !terms || !privacy} className="btn-primary w-full py-3">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Присоединиться</button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
