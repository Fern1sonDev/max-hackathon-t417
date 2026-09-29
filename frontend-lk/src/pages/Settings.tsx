import { useState } from "react";
import { Building2, Eye, Loader2, LockKeyhole, Save } from "lucide-react";
import { humanError, api, type Profile } from "../lib/api";
import { PlacePicker, Toggle, useToast } from "../components/ui";

export default function Settings({ profile, onProfile }: { profile: Profile; onProfile: (profile: Profile) => void }) {
  const toast = useToast();
  const curator = profile.role === "curator";
  const [draft, setDraft] = useState({ name: profile.name, contact_info: profile.contact_info, phone: profile.phone, university: profile.university, region: profile.region, city: profile.city });
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const nameLabel = !curator && profile.is_owner ? "Название компании" : "ФИО";
  const universityEditable = curator && profile.is_owner;

  async function save() {
    setBusy(true);
    try {
      const updated = await api.updateMe({ role: profile.role, ...draft, group: "", accept_terms: false, accept_privacy: false });
      onProfile(updated);
      toast("success", "Настройки сохранены");
    } catch (e) {
      toast("error", humanError(e, "Не удалось сохранить настройки"));
    } finally { setBusy(false); }
  }

  async function toggleDirectory() {
    try {
      onProfile(await api.setDirectoryOptIn(!profile.directory_opt_in));
    } catch (e) {
      toast("error", humanError(e, "Не удалось изменить настройку"));
    }
  }

  async function changePassword() {
    setPasswordBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword("");
      toast("success", "Пароль обновлён");
    } catch (e) {
      toast("error", humanError(e, "Не удалось обновить пароль"));
    } finally { setPasswordBusy(false); }
  }

  return (
    <div className="page max-w-3xl">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Building2 className="h-5 w-5" /></span><div><h1 className="page-title">Настройки</h1><p className="page-sub">{profile.org_name} · {profile.position || (profile.is_owner ? "владелец аккаунта" : "сотрудник")}</p></div></div>
      <section className="card mt-7 p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label sm:col-span-2">{nameLabel}<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} className="field" /></label>
          {curator && <label className="label sm:col-span-2">Вуз{!universityEditable && <span className="font-normal text-slate-400"> — задаёт администратор</span>}<input value={draft.university} disabled={!universityEditable} onChange={(e) => setDraft({ ...draft, university: e.target.value })} maxLength={200} className="field disabled:bg-slate-50 disabled:text-slate-500" /></label>}
          <PlacePicker required region={draft.region} city={draft.city} onChange={(region, city) => setDraft({ ...draft, region, city })} />
          <label className="label">Рабочий телефон<input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} maxLength={40} inputMode="tel" placeholder="+7 900 000-00-00" className="field" /></label>
          <label className="label">Контакт для студентов<input value={draft.contact_info} onChange={(e) => setDraft({ ...draft, contact_info: e.target.value })} maxLength={120} placeholder="Email или MAX" className="field" /></label>
        </div>
        <p className="mt-3 text-xs text-slate-500">Телефон подставляется в приглашения кандидатам как контакт по умолчанию.</p>
        <button onClick={save} disabled={busy || !draft.name.trim() || (curator && !draft.university.trim())} className="btn-primary mt-6">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить</button>
      </section>

      {curator && profile.is_owner && (
        <section className="card mt-5 p-5 sm:p-7">
          <div className="mb-4 flex items-center gap-2"><Eye className="h-5 w-5 text-blue-700" /><h2 className="font-bold text-slate-900">Каталог студентов для работодателей</h2></div>
          <Toggle checked={profile.directory_opt_in} onChange={toggleDirectory} label="Открыть каталог студентов вуза работодателям" hint="Работодатели увидят только тех студентов, которые сами разрешили поиск профиля в мини-приложении. Подтверждённые навыки — зелёным, заявленные — синим." />
        </section>
      )}

      <section className="card mt-5 p-5 sm:p-7">
        <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-blue-700" /><h2 className="font-bold text-slate-900">Пароль</h2></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="label">Текущий пароль<input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="field" /></label>
          <label className="label">Новый пароль<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field" /></label>
        </div>
        <button onClick={changePassword} disabled={passwordBusy || !currentPassword || newPassword.length < 8} className="btn-secondary mt-4">{passwordBusy ? "Обновляем…" : "Изменить пароль"}</button>
      </section>
    </div>
  );
}
