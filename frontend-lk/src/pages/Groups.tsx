import { ChevronRight, Clock3, GraduationCap, Loader2, Plus, QrCode, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, humanError, type Group, type GroupInput, type Profile, type TeamMember } from "../lib/api";
import ErrorState from "../components/ErrorState";
import { Combobox, Empty, Modal, PlacePicker, Skeleton, useToast } from "../components/ui";

export function GroupModal({ profile, group, onClose, onSaved }: { profile: Profile; group?: Group; onClose: () => void; onSaved: (g: Group) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<GroupInput>({ name: group?.name ?? "", course: group?.course ?? 1, specialty: group?.specialty ?? "", region: group?.region ?? profile.region, city: group?.city ?? profile.city, curator_id: group?.curator_id ?? profile.user_id });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.team().then((t) => setMembers(t.members)).catch(() => {}); }, []);

  async function save() {
    setBusy(true);
    try {
      const saved = group ? await api.updateGroup(group.group_id, draft) : await api.createGroup(draft);
      toast("success", group ? "Группа обновлена" : "Группа создана — отправьте студентам ссылку или покажите QR-код");
      onSaved(saved);
    } catch (e) {
      toast("error", humanError(e, "Не удалось сохранить группу"));
    } finally { setBusy(false); }
  }

  const curatorName = members.find((m) => m.user_id === draft.curator_id)?.name ?? "";
  return (
    <Modal title={group ? "Настройки группы" : "Новая группа"} onClose={onClose} footer={
      <div className="flex justify-end"><button onClick={save} disabled={busy || !draft.name.trim()} className="btn-primary">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{group ? "Сохранить" : "Создать группу"}</button></div>
    }>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <label className="label">Название группы<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={50} placeholder="ИВТ-б-о-21-1" className="field" /></label>
        <label className="label">Курс<select value={draft.course} onChange={(e) => setDraft({ ...draft, course: Number(e.target.value) })} className="field">{[1, 2, 3, 4, 5, 6].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
      </div>
      <label className="label mt-3">Направление подготовки<input value={draft.specialty} onChange={(e) => setDraft({ ...draft, specialty: e.target.value })} maxLength={120} placeholder="09.03.01 Информатика и вычислительная техника" className="field" /></label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><PlacePicker required region={draft.region} city={draft.city} onChange={(region, city) => setDraft({ ...draft, region, city })} /></div>
      {members.length > 1 && (
        <div className="mt-3">
          <Combobox label="Куратор группы" value={curatorName} options={members.map((m) => m.name)} onChange={(name) => setDraft({ ...draft, curator_id: members.find((m) => m.name === name)?.user_id ?? draft.curator_id })} />
        </div>
      )}
      <p className="mt-4 rounded-xl bg-blue-50/70 p-3 text-xs leading-5 text-slate-600">Студент, открывший ссылку группы, получит вуз, группу, регион и город автоматически — поменять их сам он не сможет.</p>
    </Modal>
  );
}

export default function Groups({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    setError("");
    api.listGroups().then(setGroups).catch((e) => setError(humanError(e, "Не удалось загрузить группы")));
  }
  useEffect(load, []);

  const total = (groups ?? []).reduce((sum, g) => sum + g.students_count, 0);
  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Группы</h1>
          <p className="page-sub">{groups?.length ? `${groups.length} групп · ${total} студентов на платформе. ` : ""}У каждой группы своя ссылка и QR-код для входа в MAX.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary"><Plus className="h-4 w-4" />Создать группу</button>
      </div>

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}
      {!error && groups === null && <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>}
      {!error && groups?.length === 0 && <div className="mt-6"><Empty illustration="/illustrations/empty-groups.webp" icon={<UsersRound className="h-6 w-6" />} title="Создайте первую группу" text="Покажите QR-код на паре — студенты зарегистрируются в MAX за минуту, и группа наполнится сама." action={<button onClick={() => setCreating(true)} className="btn-primary"><Plus className="h-4 w-4" />Создать группу</button>} /></div>}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups?.map((g) => (
          <button key={g.group_id} onClick={() => navigate(`/groups/${g.group_id}`)} className="card group flex flex-col p-5 text-left transition hover:border-blue-300 hover:shadow-lift">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><GraduationCap className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold text-slate-900">{g.name}</h3>
                <p className="truncate text-xs text-slate-500">{[g.course ? `${g.course} курс` : "", g.specialty].filter(Boolean).join(" · ") || "Направление не указано"}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:text-blue-600" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
              <div><p className="text-lg font-bold tabular text-slate-900">{g.students_count}</p><p className="text-[11px] text-slate-500">студентов</p></div>
              <div><p className="text-lg font-bold tabular text-slate-900">{g.with_applications}</p><p className="text-[11px] text-slate-500">с откликами</p></div>
              <div><p className="text-lg font-bold tabular text-emerald-700">{g.accepted}</p><p className="text-[11px] text-slate-500">приглашены</p></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {g.to_review > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 font-bold text-white"><Clock3 className="h-3 w-3" />Ждут проверки: {g.to_review}</span> : <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">Всё проверено</span>}
              {g.passive > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700">Группа риска: {g.passive}</span>}
              <span className="ml-auto inline-flex items-center gap-1 text-slate-400"><QrCode className="h-3.5 w-3.5" />{g.curator_name || "куратор не назначен"}</span>
            </div>
          </button>
        ))}
      </div>
      {creating && <GroupModal profile={profile} onClose={() => setCreating(false)} onSaved={(g) => { setCreating(false); navigate(`/groups/${g.group_id}`); }} />}
    </div>
  );
}
