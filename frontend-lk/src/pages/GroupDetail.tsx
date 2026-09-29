import { ArrowLeft, Copy, Download, MapPin, Pencil, Phone, Printer, RefreshCw, Search, ShieldCheck, Trash2, UserX } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, humanError, type Group, type Profile, type Student } from "../lib/api";
import ErrorState from "../components/ErrorState";
import SkillReview, { SkillSummary } from "../components/SkillReview";
import { Avatar, Empty, Modal, Skeleton, copyText, useToast } from "../components/ui";
import { GroupModal } from "./Groups";

type Filter = "all" | "review" | "risk";

export default function GroupDetail({ profile }: { profile: Profile }) {
  const { id } = useParams();
  const groupId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState<Student | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const qrBox = useRef<HTMLDivElement>(null);

  function load() {
    setError("");
    Promise.all([api.getGroup(groupId), api.groupStudents(groupId)])
      .then(([g, list]) => { setGroup(g); setStudents(list); })
      .catch((e) => setError(humanError(e, "Не удалось загрузить группу")));
    api.listGroups().then(setAllGroups).catch(() => {});
  }
  useEffect(load, [groupId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (students ?? []).filter((s) => (!q || s.name.toLowerCase().includes(q)) && (filter === "all" || (filter === "review" ? s.skills.some((k) => k.status === "claimed") : s.is_passive)));
  }, [students, filter, query]);

  function qrDataUrl(): string | null {
    const canvas = qrBox.current?.querySelector("canvas");
    return canvas ? canvas.toDataURL("image/png") : null;
  }

  function downloadQr() {
    const url = qrDataUrl();
    if (!url || !group) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${group.name}.png`;
    a.click();
  }

  function printQr() {
    const url = qrDataUrl();
    if (!url || !group) return;
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(group.name)}</title><body style="font-family:Inter,system-ui,sans-serif;text-align:center;padding:48px"><h1 style="margin:0">Группа ${esc(group.name)}</h1><p style="color:#555">${esc(group.university)}</p><img src="${url}" style="width:420px;height:420px;margin:24px auto;display:block"><p style="font-size:20px"><b>Отсканируйте камерой телефона</b> — откроется ПрактикаПлюс в MAX,<br>вуз и группа заполнятся автоматически.</p><p style="color:#777;font-size:13px">${esc(group.invite_url)}</p><script>setTimeout(()=>print(),300)</script></body>`);
    w.document.close();
  }

  async function rotate() {
    try {
      setGroup(await api.rotateGroupInvite(groupId));
      setConfirmRotate(false);
      toast("success", "Новая ссылка готова — старая больше не работает");
    } catch (e) {
      toast("error", humanError(e, "Не удалось перевыпустить ссылку"));
    }
  }

  async function remove() {
    try {
      await api.deleteGroup(groupId);
      toast("success", "Группа удалена");
      navigate("/groups");
    } catch (e) {
      toast("error", humanError(e, "Не удалось удалить группу"));
    }
  }

  async function move(student: Student, target: number) {
    try {
      await api.moveStudent(student.user_id, target);
      setStudents((list) => list && list.filter((s) => s.user_id !== student.user_id));
      toast("success", `${student.name} переведён(а) в другую группу`);
    } catch (e) {
      toast("error", humanError(e, "Не удалось перевести студента"));
    }
  }

  if (error) return <div className="page"><ErrorState message={error} onRetry={load} /></div>;
  if (!group || !students) return <div className="page space-y-4"><Skeleton className="h-56" /><Skeleton className="h-80" /></div>;

  const counts = { all: students.length, review: students.filter((s) => s.skills.some((k) => k.status === "claimed")).length, risk: students.filter((s) => s.is_passive).length };

  return (
    <div className="page">
      <Link to="/groups" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-700"><ArrowLeft className="h-4 w-4" />Все группы</Link>
      <section className="mt-4 grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{group.name}</h1>
              <p className="mt-1 text-sm text-slate-500">{[group.course ? `${group.course} курс` : "", group.specialty].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" />{[group.city, group.region].filter(Boolean).join(", ") || "Город не указан"} · куратор: {group.curator_name || "не назначен"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="btn-secondary px-3"><Pencil className="h-4 w-4" />Изменить</button>
              {students.length === 0 && <button onClick={remove} className="btn-secondary px-3 text-rose-700" aria-label="Удалить группу"><Trash2 className="h-4 w-4" /></button>}
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Студентов", group.students_count, "text-slate-900"], ["Ждут проверки", group.to_review, "text-blue-700"], ["С откликами", group.with_applications, "text-slate-900"], ["Приглашены", group.accepted, "text-emerald-700"]].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-xl bg-slate-50 px-3 py-2.5"><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-0.5 text-xl font-bold tabular ${tone}`}>{value}</dd></div>
            ))}
          </dl>
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-700">Ссылка-приглашение группы</p>
            <div className="mt-2 flex gap-2">
              <input readOnly value={group.invite_url} onFocus={(e) => e.target.select()} className="field mt-0 bg-slate-50 font-mono text-xs text-slate-600" aria-label="Ссылка-приглашение" />
              <button onClick={() => copyText(group.invite_url).then((ok) => toast(ok ? "success" : "error", ok ? "Ссылка скопирована — отправьте её в чат группы в MAX" : "Не удалось скопировать"))} className="btn-primary shrink-0"><Copy className="h-4 w-4" />Копировать</button>
            </div>
            <button onClick={() => setConfirmRotate(true)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-700"><RefreshCw className="h-3.5 w-3.5" />Перевыпустить ссылку, если она попала не туда</button>
          </div>
        </div>
        <div className="card flex flex-col items-center justify-center p-6">
          <div ref={qrBox} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><QRCodeCanvas value={group.invite_url} size={184} fgColor="#0B1220" marginSize={1} /></div>
          <p className="mt-3 text-center text-xs text-slate-500">Покажите на паре — студенты отсканируют<br />и сразу попадут в группу</p>
          <div className="mt-3 flex gap-2">
            <button onClick={downloadQr} className="btn-secondary px-3 py-2 text-xs"><Download className="h-3.5 w-3.5" />PNG</button>
            <button onClick={printQr} className="btn-secondary px-3 py-2 text-xs"><Printer className="h-3.5 w-3.5" />Печать</button>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по ФИО" className="field mt-0 pl-10" />
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {([["all", "Все"], ["review", "Ждут проверки"], ["risk", "Группа риска"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-1.5 transition ${filter === key ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{label} <span className="text-slate-400">{counts[key]}</span></button>
          ))}
        </div>
      </div>

      {students.length === 0 ? (
        <div className="mt-4"><Empty illustration="/illustrations/empty-groups.webp" icon={<UserX className="h-6 w-6" />} title="В группе пока никого" text="Отправьте ссылку в чат группы или покажите QR-код — студенты появятся здесь сразу после регистрации в MAX." /></div>
      ) : (
        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Студент</th><th className="hidden px-3 py-3 md:table-cell">Навыки</th><th className="hidden px-3 py-3 lg:table-cell">Отклики</th><th className="px-5 py-3 text-right">Действия</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((s) => (
                <tr key={s.user_id} className="align-middle">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} size={36} src={s.avatar_url} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{s.name}{s.is_passive && <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">риск</span>}</p>
                        {s.phone ? <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700"><Phone className="h-3 w-3" />{s.phone}</a> : <p className="text-xs text-slate-400">{s.contact_info || "контакт не указан"}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3.5 md:table-cell"><SkillSummary student={s} /></td>
                  <td className="hidden px-3 py-3.5 text-xs text-slate-600 lg:table-cell">{s.applications} · <span className="font-semibold text-emerald-700">{s.accepted} приглаш.</span></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {allGroups.length > 1 && (
                        <select aria-label={`Перевести ${s.name}`} value="" onChange={(e) => e.target.value && move(s, Number(e.target.value))} className="hidden rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 xl:block">
                          <option value="">Перевести…</option>
                          {allGroups.filter((g) => g.group_id !== groupId).map((g) => <option key={g.group_id} value={g.group_id}>{g.name}</option>)}
                        </select>
                      )}
                      <button onClick={() => setReviewing(s)} className={s.skills.some((k) => k.status === "claimed") ? "btn-primary px-3 py-2 text-xs" : "btn-secondary px-3 py-2 text-xs"}><ShieldCheck className="h-3.5 w-3.5" />Проверить</button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">Никого не нашли — измените фильтр.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && <SkillReview student={reviewing} onClose={() => setReviewing(null)} onSaved={(updated) => { setStudents((list) => list && list.map((s) => (s.user_id === updated.user_id ? updated : s))); setReviewing(null); api.getGroup(groupId).then(setGroup).catch(() => {}); }} />}
      {editing && <GroupModal profile={profile} group={group} onClose={() => setEditing(false)} onSaved={(g) => { setGroup(g); setEditing(false); load(); }} />}
      {confirmRotate && (
        <Modal title="Перевыпустить ссылку?" onClose={() => setConfirmRotate(false)} footer={<div className="flex justify-end gap-2"><button onClick={() => setConfirmRotate(false)} className="btn-secondary">Отмена</button><button onClick={rotate} className="btn-primary">Перевыпустить</button></div>}>
          <p className="text-sm leading-6 text-slate-600">Старая ссылка и QR-код перестанут работать. Уже зарегистрированные студенты останутся в группе.</p>
        </Modal>
      )}
    </div>
  );
}
