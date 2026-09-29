import { LogOut, Menu } from "lucide-react";
import type { Profile } from "../lib/api";
import { Avatar } from "./ui";

export default function Topbar({ profile, onLogout, onOpenMobileNav }: { profile: Profile; onLogout: () => void; onOpenMobileNav: () => void }) {
  const role = profile.position || (profile.role === "curator" ? (profile.is_owner ? "Администратор вуза" : "Куратор") : profile.is_owner ? "HR-директор" : "Рекрутер");
  const person = profile.role === "hr" && profile.is_owner && profile.person_name ? profile.person_name : profile.name;
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur md:px-8">
      <button onClick={onOpenMobileNav} aria-label="Меню" className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 md:hidden"><Menu className="h-5 w-5" /></button>
      <p className="hidden min-w-0 truncate text-sm text-slate-500 md:block">{profile.org_name || (profile.role === "curator" ? profile.university : "Кабинет работодателя")}</p>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={person} size={34} src={profile.avatar_url} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-slate-900">{person}</p>
          <p className="truncate text-xs text-slate-500">{role}</p>
        </div>
        <button onClick={onLogout} aria-label="Выйти" title="Выйти" className="ml-1 rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"><LogOut className="h-4 w-4" /></button>
      </div>
    </header>
  );
}
