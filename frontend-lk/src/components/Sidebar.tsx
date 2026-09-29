import { BarChart3, Briefcase, ClipboardCheck, LayoutGrid, Plug, Settings2, ShieldCheck, Trophy, Users, UsersRound, X, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { Profile } from "../lib/api";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
  }`;

type Item = [to: string, label: string, Icon: LucideIcon];

const SECTIONS: Record<"hr" | "curator", { title: string; items: Item[] }[]> = {
  hr: [
    { title: "Работа", items: [["/", "Сводка", LayoutGrid], ["/vacancies", "Стажировки и отклики", Briefcase], ["/directory", "Каталог студентов", Users], ["/tests", "Тесты с вузами", ClipboardCheck]] },
    { title: "Данные", items: [["/analytics", "Аналитика", BarChart3], ["/leaderboard", "Витрина талантов", Trophy]] },
    { title: "Организация", items: [["/team", "Команда", UsersRound], ["/integrations", "Интеграции", Plug], ["/settings", "Настройки", Settings2]] },
  ],
  curator: [
    { title: "Работа", items: [["/", "Сводка", LayoutGrid], ["/groups", "Группы", UsersRound], ["/review", "Проверка навыков", ShieldCheck], ["/tests", "Тесты навыков", ClipboardCheck]] },
    { title: "Данные", items: [["/analytics", "Аналитика вуза", BarChart3], ["/leaderboard", "Витрина талантов", Trophy]] },
    { title: "Организация", items: [["/team", "Команда", Users], ["/integrations", "Интеграции", Plug], ["/settings", "Настройки", Settings2]] },
  ],
};

function Nav({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  const sections = SECTIONS[profile.role === "curator" ? "curator" : "hr"];
  return (
    <nav className="mt-7 flex flex-1 flex-col gap-1 overflow-y-auto" onClick={onNavigate}>
      {sections.map((section, i) => (
        <div key={section.title} className={i ? "mt-4" : ""}>
          <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{section.title}</p>
          {section.items.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/"} className={linkClass}><Icon className="h-[18px] w-[18px]" />{label}</NavLink>)}
        </div>
      ))}
      <div className="mt-auto rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
        <p className="truncate font-semibold text-slate-800">{profile.org_name || profile.name}</p>
        <p>{profile.is_owner ? (profile.role === "hr" ? "Владелец аккаунта компании" : "Администратор вуза") : profile.position || (profile.role === "hr" ? "Рекрутер" : "Куратор")}</p>
      </div>
    </nav>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <img src="/logo-mark.svg" alt="" className="h-9 w-9" />
      <span className="text-[17px] font-extrabold tracking-tight text-slate-900">Практика<span className="text-blue-700">Плюс</span></span>
    </div>
  );
}

export default function Sidebar({ profile, mobileOpen, onCloseMobile }: { profile: Profile; mobileOpen: boolean; onCloseMobile: () => void }) {
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white px-4 py-6 md:flex">
        <Brand />
        <Nav profile={profile} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white px-4 py-6 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button onClick={onCloseMobile} aria-label="Закрыть меню" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <Nav profile={profile} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
