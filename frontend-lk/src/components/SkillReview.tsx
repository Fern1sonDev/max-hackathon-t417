import { BadgeCheck, Handshake, Loader2, Phone, Save, Share2, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { api, humanError, type SkillStatus, type Student } from "../lib/api";
import { Avatar, Drawer, SKILL_STATUS, copyText, useToast } from "./ui";

const OPTIONS: { status: SkillStatus; label: string; icon: typeof BadgeCheck; active: string }[] = [
  { status: "verified", label: "Подтвердить", icon: BadgeCheck, active: "bg-emerald-600 text-white" },
  { status: "employer_review", label: "На усмотрение работодателя", icon: Handshake, active: "bg-violet-600 text-white" },
  { status: "rejected", label: "Отклонить", icon: XCircle, active: "bg-slate-700 text-white" },
];

const COMMENT_HINTS: Record<SkillStatus, string[]> = {
  verified: ["Курсовой проект", "Лабораторные работы", "Участие в хакатоне", "Практика на кафедре"],
  employer_review: ["Изучал самостоятельно", "Не входит в программу", "Есть пет-проект"],
  rejected: ["Нет подтверждения", "Не изучалось в курсе"],
  claimed: [],
};

type Draft = Record<number, { status: SkillStatus; comment: string }>;

/** Batch review: the curator sets a decision per skill and saves once — the
 * student receives a single summary message in MAX. */
export default function SkillReview({ student, onClose, onSaved }: { student: Student; onClose: () => void; onSaved: (s: Student) => void }) {
  const toast = useToast();
  const initial = useMemo<Draft>(() => Object.fromEntries(student.skills.map((k) => [k.skill_id, { status: k.status, comment: k.comment }])), [student]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const changed = student.skills.filter((k) => draft[k.skill_id].status !== k.status || draft[k.skill_id].comment.trim() !== k.comment);
  const pendingCount = student.skills.filter((k) => draft[k.skill_id].status === "claimed").length;

  const set = (id: number, patch: Partial<Draft[number]>) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  function verifyAll() {
    setDraft((d) => Object.fromEntries(Object.entries(d).map(([id, v]) => [id, v.status === "claimed" ? { ...v, status: "verified" as SkillStatus } : v])));
  }

  async function save() {
    setBusy(true);
    try {
      const result = await api.reviewSkills(student.user_id, changed.map((k) => ({ skill_id: k.skill_id, status: draft[k.skill_id].status, comment: draft[k.skill_id].comment.trim() })));
      toast("success", result.notified ? `Сохранено: ${result.changed}. Студенту ушло одно сводное уведомление в MAX` : "Сохранено");
      onSaved(result.student);
    } catch (e) {
      toast("error", humanError(e, "Не удалось сохранить проверку"));
    } finally { setBusy(false); }
  }

  async function certificate(skillId: number) {
    try {
      const { url } = await api.certificateLink(student.user_id, skillId);
      if (await copyText(url)) toast("success", "Ссылка на сертификат скопирована");
    } catch (e) {
      toast("error", humanError(e, "Сертификат недоступен"));
    }
  }

  return (
    <Drawer label={`Проверка навыков: ${student.name}`} onClose={onClose}>
      <div className="flex items-start gap-4 border-b border-slate-100 p-6">
        <Avatar name={student.name} size={52} src={student.avatar_url} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">{student.name}</h2>
          <p className="text-sm text-slate-500">{[student.group, student.city].filter(Boolean).join(" · ") || "Группа не указана"}</p>
          {student.phone && <a href={`tel:${student.phone.replace(/[^\d+]/g, "")}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-700"><Phone className="h-3.5 w-3.5" />{student.phone}</a>}
        </div>
        <button onClick={onClose} aria-label="Закрыть" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Отметьте решение по каждому навыку и сохраните один раз — студент получит <b>одно</b> сводное сообщение.</p>
          {pendingCount > 0 && <button onClick={verifyAll} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100">Подтвердить все ожидающие ({pendingCount})</button>}
        </div>
        {student.skills.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Студент ещё не указал навыки.</p>}
        {[...student.skills].sort((a, b) => Number(b.status === "claimed") - Number(a.status === "claimed")).map((k) => {
          const d = draft[k.skill_id];
          const was = SKILL_STATUS[k.status];
          const dirty = d.status !== k.status || d.comment.trim() !== k.comment;
          return (
            <article key={k.skill_id} className={`rounded-2xl border p-4 transition ${dirty ? "border-blue-300 bg-blue-50/30" : "border-slate-200/80"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-900">{k.name}</p>
                <span className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${was.cls}`}>{was.icon}{was.label}</span>
                  {k.status === "verified" && <button onClick={() => certificate(k.skill_id)} title="Ссылка на сертификат" aria-label={`Сертификат ${k.name}`} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-50"><Share2 className="h-3.5 w-3.5" /></button>}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {OPTIONS.map(({ status, label, icon: Icon, active }) => (
                  <button key={status} onClick={() => set(k.skill_id, { status: d.status === status ? k.status === status ? "claimed" : k.status : status })} aria-pressed={d.status === status} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${d.status === status ? active : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
              {d.status !== "claimed" && (
                <div className="mt-3">
                  <input value={d.comment} onChange={(e) => set(k.skill_id, { comment: e.target.value })} maxLength={300} placeholder={d.status === "verified" ? "Основание: курсовой проект, хакатон…" : "Комментарий для студента и работодателя"} className="field mt-0 text-sm" aria-label={`Комментарий к ${k.name}`} />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {COMMENT_HINTS[d.status].map((h) => <button key={h} onClick={() => set(k.skill_id, { comment: h })} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200 hover:text-blue-700 hover:ring-blue-300">{h}</button>)}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white p-5">
        <p className="text-xs text-slate-500">{changed.length ? `Изменений: ${changed.length}` : "Изменений нет"}</p>
        <button onClick={save} disabled={busy || changed.length === 0} className="btn-primary min-w-48">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить{changed.length ? ` (${changed.length})` : ""}</button>
      </div>
    </Drawer>
  );
}

export function SkillSummary({ student }: { student: Student }) {
  const count = (s: SkillStatus) => student.skills.filter((k) => k.status === s).length;
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
      {count("verified") > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{count("verified")} подтв.</span>}
      {count("employer_review") > 0 && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">{count("employer_review")} на усмотр.</span>}
      {count("claimed") > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-white">{count("claimed")} ждут</span>}
      {count("rejected") > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{count("rejected")} откл.</span>}
      {student.skills.length === 0 && <span className="text-slate-400">навыков нет</span>}
    </div>
  );
}
