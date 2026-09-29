import { BadgeCheck, Clock3, Handshake, Minus, Waypoints } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { computeMatch, type Requirement, type SkillState, type Status } from "../lib/match";
import Container from "./ui/Container";
import Reveal from "./ui/Reveal";
import SectionHeading from "./ui/SectionHeading";

const REQUIREMENTS: Requirement[] = [
  { skill: "Linux", core: true },
  { skill: "Защищённые сетевые соединения", core: true },
  { skill: "NetBox", core: true },
  { skill: "Zabbix", core: false },
  { skill: "Proxmox", core: false },
];

// Skills of the demo student and their families (FreeBSD is adjacent to Linux).
const STUDENT_SKILLS = ["Linux", "FreeBSD", "Защищённые сетевые соединения", "NetBox", "Zabbix", "Proxmox"];
const FAMILIES: Record<string, string> = { Linux: "unix", FreeBSD: "unix", Proxmox: "virt", Zabbix: "monitoring" };
const CYCLE: (SkillState | undefined)[] = [undefined, "claimed", "employer", "verified"];

const LOOK: Record<Status, { chip: string; dot: string; icon: ReactNode; label: string }> = {
  verified: { chip: "bg-emerald-600 text-white shadow-md shadow-emerald-600/20", dot: "bg-emerald-50 text-emerald-600", icon: <BadgeCheck className="h-4 w-4" />, label: "подтверждён вузом · ×1" },
  employer: { chip: "bg-violet-600 text-white shadow-md shadow-violet-600/20", dot: "bg-violet-50 text-violet-600", icon: <Handshake className="h-4 w-4" />, label: "на усмотрение работодателя · ×0,75" },
  claimed: { chip: "bg-blue-600 text-white shadow-md shadow-blue-600/20", dot: "bg-blue-50 text-blue-600", icon: <Clock3 className="h-4 w-4" />, label: "заявлен студентом · ×0,5" },
  related: { chip: "", dot: "bg-amber-50 text-amber-600", icon: <Waypoints className="h-4 w-4" />, label: "смежный" },
  missing: { chip: "bg-slate-100 text-slate-500 hover:bg-slate-200", dot: "bg-slate-100 text-slate-400", icon: <Minus className="h-4 w-4" />, label: "нет" },
};

function tone(score: number) {
  if (score >= 80) return { text: "text-emerald-600", label: "Отлично подходит" };
  if (score >= 50) return { text: "text-blue-700", label: "Хорошо подходит" };
  if (score > 0) return { text: "text-amber-600", label: "Частично подходит" };
  return { text: "text-slate-500", label: "Нет совпадений" };
}

export default function LiveDemo() {
  const [student, setStudent] = useState<Record<string, SkillState>>({ FreeBSD: "verified", "Защищённые сетевые соединения": "verified", NetBox: "claimed", Zabbix: "employer" });
  const { score, verifiedScore, items } = useMemo(() => computeMatch(REQUIREMENTS, student, FAMILIES), [student]);
  const t = tone(score);
  const size = 176, stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r;

  function cycle(skill: string) {
    setStudent((prev) => {
      const next = { ...prev };
      const state = CYCLE[(CYCLE.indexOf(prev[skill]) + 1) % CYCLE.length];
      if (state) next[skill] = state; else delete next[skill];
      return next;
    });
  }

  return (
    <section id="index" className="bg-white py-24 sm:py-28">
      <Container>
        <SectionHeading eyebrow="Индекс соответствия" title="Честная цифра вместо «подходит / не подходит»" description="Учитываются все навыки студента, но с разным доверием: подтверждённый вузом — полностью, «на усмотрение работодателя» — на 75%, заявленный — наполовину. Работодатель видит обе цифры: общий индекс и долю, подтверждённую вузом." />
        <Reveal className="mx-auto mt-14 max-w-5xl">
          <div className="grid overflow-hidden rounded-[32px] bg-white shadow-2xl shadow-blue-900/10 ring-1 ring-slate-200 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 sm:p-9">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Шаг 1 · нажимайте на навыки студента</p>
              <p className="mt-1 text-xs text-slate-500">нет → заявлен → на усмотрение → подтверждён вузом</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {STUDENT_SKILLS.map((skill) => {
                  const state = student[skill];
                  const look = LOOK[state ?? "missing"];
                  return (
                    <button key={skill} onClick={() => cycle(skill)} aria-label={`${skill}: ${look.label}`} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${look.chip}`}>
                      {state && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{look.icon}</span>}{skill}
                    </button>
                  );
                })}
              </div>
              <p className="mt-8 text-xs font-bold uppercase tracking-wider text-slate-400">Шаг 2 · требования «Стажёр по сетевой инфраструктуре»</p>
              <ul className="mt-4 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
                {items.map((item) => (
                  <li key={item.skill} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${LOOK[item.status].dot}`}>{LOOK[item.status].icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-800">{item.skill}</span>
                      <span className="block text-xs text-slate-500">{item.status === "related" ? `смежный: ${item.via} · ×${String(item.credit).replace(".", ",")}` : LOOK[item.status].label}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${item.core ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{item.core ? "ключевой ×2" : "желательный ×1"}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-8 text-center sm:p-9">
              <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                  <circle cx={size / 2} cy={size / 2} r={r} stroke="#E4EAF4" strokeWidth={stroke} fill="none" />
                  <circle cx={size / 2} cy={size / 2} r={r} stroke="#8FB2FF" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} style={{ transition: "stroke-dasharray .6s cubic-bezier(.16,1,.3,1)" }} />
                  <circle cx={size / 2} cy={size / 2} r={r} stroke="#12B76A" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(verifiedScore / 100) * c} ${c}`} style={{ transition: "stroke-dasharray .6s cubic-bezier(.16,1,.3,1)" }} />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-4xl font-extrabold tracking-tight ${t.text}`}>{Math.round(score)}%</span>
              </div>
              <p className={`mt-5 text-lg font-bold ${t.text}`}>{t.label}</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">из них подтверждено вузом: {Math.round(verifiedScore)}%</p>
              <p className="mt-4 max-w-xs font-mono text-xs leading-5 text-slate-500">индекс = Σ вес × зачёт / Σ вес<br />вес: 2 — ключевой, 1 — желательный<br />зачёт: 1 · 0,75 · 0,5 · смежный ×0,5</p>
              <p className="mt-5 text-[11px] leading-4 text-slate-400">Учебный пример: расчёт совпадает с сервисом, но не использует данные реальных студентов.</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
