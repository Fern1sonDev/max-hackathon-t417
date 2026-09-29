import { BadgeCheck, KanbanSquare, LineChart } from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "./Sidebar";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="flex items-center gap-2.5">
          <img src="/logo-mark.svg" alt="" className="h-10 w-10 rounded-xl ring-2 ring-white/30" />
          <span className="text-lg font-extrabold tracking-tight">ПрактикаПлюс</span>
        </div>
        <h1 className="mt-12 max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight">Стажёры с навыками, которые подтвердил вуз</h1>
        <ul className="mt-8 max-w-md space-y-4 text-[15px] text-white/90">
          <li className="flex gap-3"><BadgeCheck className="h-5 w-5 shrink-0" />Вуз проверяет навыки группы: подтвердить, «на усмотрение работодателя» или отклонить</li>
          <li className="flex gap-3"><KanbanSquare className="h-5 w-5 shrink-0" />Воронка по каждой стажировке, телефон кандидата и приглашение со следующим шагом</li>
          <li className="flex gap-3"><LineChart className="h-5 w-5 shrink-0" />Аналитика разрыва компетенций и упущенного спроса по регионам</li>
        </ul>
        <div className="relative -mb-12 mt-auto flex items-end justify-center gap-2">
          <div className="absolute inset-x-10 bottom-0 h-40 rounded-t-full bg-white/15 blur-2xl" />
          <img src="/illustrations/curator.webp" alt="" className="relative h-80 w-auto drop-shadow-2xl" />
          <img src="/illustrations/employer.webp" alt="" className="relative h-80 w-auto drop-shadow-2xl" />
        </div>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Brand /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
