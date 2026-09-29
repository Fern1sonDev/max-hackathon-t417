import { Copy, Crown, Link2, Loader2, Mail, Trash2, UserPlus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatDate, humanError, type Profile, type Team as TeamData, type TeamInvite } from "../lib/api";
import ErrorState from "../components/ErrorState";
import { Avatar, Modal, Skeleton, copyText, useToast } from "../components/ui";

export default function Team({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", position: "" });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<TeamInvite | null>(null);
  const hr = profile.role === "hr";

  function load() {
    setError("");
    api.team().then(setTeam).catch((e) => setError(humanError(e, "Не удалось загрузить команду")));
  }
  useEffect(load, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const inv = await api.inviteMember({ name: draft.name.trim(), email: draft.email.trim(), position: draft.position.trim() });
      setCreated(inv);
      setDraft({ name: "", email: "", position: "" });
      load();
    } catch (err) {
      toast("error", humanError(err, "Не удалось создать приглашение"));
    } finally { setBusy(false); }
  }

  async function revoke(token: string) {
    try { await api.revokeInvite(token); load(); toast("success", "Приглашение отозвано"); } catch (e) { toast("error", humanError(e, "Не удалось отозвать")); }
  }

  async function remove(userId: string, name: string) {
    if (!window.confirm(`Отключить ${name}? Доступ к кабинету пропадёт, созданные стажировки и проверки останутся у организации.`)) return;
    try { await api.removeMember(userId); load(); toast("success", "Сотрудник отключён"); } catch (e) { toast("error", humanError(e, "Не удалось отключить")); }
  }

  return (
    <div className="page max-w-5xl">
      <h1 className="page-title">Команда</h1>
      <p className="page-sub">{hr ? "Владелец аккаунта (HR-директор) приглашает рекрутеров — все работают с общими стажировками и кандидатами." : "Администратор вуза приглашает кураторов — каждый ведёт свои группы, аналитика общая."}</p>

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}
      {!error && !team && <Skeleton className="mt-6 h-64" />}
      {team && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 font-bold text-slate-900"><UsersRound className="h-5 w-5 text-blue-700" />{team.org_name}</h2>
              <span className="text-xs font-semibold text-slate-500">{team.members.length} в команде</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {team.members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={m.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">{m.name}{m.is_owner && <Crown className="h-3.5 w-3.5 text-amber-500" aria-label="Владелец" />}{m.user_id === profile.user_id && <span className="text-xs font-normal text-slate-400">(вы)</span>}</p>
                    <p className="truncate text-xs text-slate-500">{[m.position || (m.is_owner ? (hr ? "HR-директор" : "Администратор") : ""), m.email].filter(Boolean).join(" · ")}</p>
                  </div>
                  {profile.is_owner && !m.is_owner && <button onClick={() => remove(m.user_id, m.name)} aria-label={`Отключить ${m.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
            {team.invites.length > 0 && (
              <>
                <p className="border-t border-slate-100 bg-slate-50 px-5 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">Ожидают принятия</p>
                <ul className="divide-y divide-slate-100">
                  {team.invites.map((i) => (
                    <li key={i.token} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Mail className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{i.name} · {i.position}</p><p className="truncate text-xs text-slate-500">{i.email} · до {formatDate(i.expires_at, false)}</p></div>
                      <button onClick={() => copyText(i.url).then((ok) => ok && toast("success", "Ссылка скопирована"))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-blue-700" aria-label="Скопировать ссылку"><Copy className="h-4 w-4" /></button>
                      <button onClick={() => revoke(i.token)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Отозвать"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><UserPlus className="h-5 w-5 text-blue-700" />Пригласить {hr ? "рекрутера" : "куратора"}</h2>
            {profile.is_owner ? (
              <form onSubmit={invite} className="mt-4 space-y-3">
                <label className="label">ФИО<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} placeholder="Мария Кузнецова" className="field" /></label>
                <label className="label">Рабочий email<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="field" /></label>
                <label className="label">Должность<input value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} maxLength={80} placeholder={hr ? "Рекрутер" : "Куратор практики кафедры ИВТ"} className="field" /></label>
                <button type="submit" disabled={busy || draft.name.trim().length < 2 || !draft.email.includes("@")} className="btn-primary w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}Создать ссылку-приглашение</button>
                <p className="text-xs leading-5 text-slate-500">Ссылка действует 7 дней. Сотрудник задаст пароль сам — вы его не увидите.</p>
              </form>
            ) : <p className="mt-3 text-sm text-slate-500">Приглашать сотрудников может владелец аккаунта организации.</p>}
          </section>
        </div>
      )}

      {created && (
        <Modal title="Приглашение создано" onClose={() => setCreated(null)} footer={<div className="flex justify-end"><button onClick={() => copyText(created.url).then((ok) => { if (ok) { toast("success", "Ссылка скопирована"); setCreated(null); } })} className="btn-primary"><Copy className="h-4 w-4" />Скопировать и закрыть</button></div>}>
          <p className="text-sm text-slate-600">Отправьте ссылку {created.name} в рабочем мессенджере или по почте:</p>
          <input readOnly value={created.url} onFocus={(e) => e.target.select()} className="field bg-slate-50 font-mono text-xs" />
        </Modal>
      )}
    </div>
  );
}
