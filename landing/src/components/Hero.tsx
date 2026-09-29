import { ArrowRight, BadgeCheck, BellRing, Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import { BOT_URL, LK_URL } from "../config";
import Container from "./ui/Container";
import Reveal from "./ui/Reveal";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pb-20 pt-12 sm:pb-28 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_10%,#DCE8FF_0%,transparent_70%),radial-gradient(40%_40%_at_10%_90%,#EAE2FF_0%,transparent_70%)]" />
      <Container className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-800 shadow-sm ring-1 ring-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Мини-приложение и бот в MAX · для студентов, вузов и компаний
            </span>
          </Reveal>
          <Reveal delayMs={80}>
            <h1 className="mt-6 text-[42px] font-extrabold leading-[1.04] tracking-tight text-slate-950 sm:text-6xl">
              Практика, где важно, <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">что ты умеешь</span>
            </h1>
          </Reveal>
          <Reveal delayMs={150}>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Куратор вуза подтверждает навыки студента. ПрактикаПлюс считает честный индекс соответствия каждой стажировке, а отклик, тестовое задание и решение компании проходят прямо в мессенджере MAX.
            </p>
          </Reveal>
          <Reveal delayMs={220}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={BOT_URL} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-6 py-3.5 text-[15px] font-semibold text-white shadow-lift transition hover:bg-blue-800"><MessageCircle className="h-5 w-5" />Найти стажировку в MAX</a>
              <a href={LK_URL} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-[15px] font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:ring-slate-300">Кабинет вуза и компании<ArrowRight className="h-5 w-5" /></a>
            </div>
          </Reveal>
          <Reveal delayMs={290}>
            <dl className="mt-10 grid max-w-lg grid-cols-1 gap-4 border-t border-slate-200 pt-6 sm:grid-cols-3">
              <div><dt className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-blue-700" />Индекс</dt><dd className="mt-1 text-sm font-semibold text-slate-900">только по подтверждённым навыкам</dd></div>
              <div><dt className="flex items-center gap-1.5 text-xs text-slate-500"><BellRing className="h-3.5 w-3.5 text-blue-700" />Задание</dt><dd className="mt-1 text-sm font-semibold text-slate-900">приходит в чат сразу после отклика</dd></div>
              <div><dt className="flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5 text-blue-700" />Ответ</dt><dd className="mt-1 text-sm font-semibold text-slate-900">не позже 72 часов — или альтернатива</dd></div>
            </dl>
          </Reveal>
        </div>

        <Reveal delayMs={120} className="relative mx-auto w-full max-w-[520px]">
          <div className="relative flex items-end justify-center">
            <div className="absolute bottom-6 left-6 hidden h-72 w-72 rounded-full bg-gradient-to-br from-blue-200 to-violet-200 blur-2xl sm:block" />
            <img src="/illustrations/student.webp" alt="" className="absolute -left-4 bottom-0 hidden h-[430px] w-auto drop-shadow-xl sm:block" />
            <div className="relative ml-auto mr-2 w-[290px] rounded-[44px] bg-slate-950 p-3 shadow-2xl shadow-blue-900/30 ring-1 ring-slate-800 sm:mr-0">
              <div className="absolute left-1/2 top-3 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-slate-950" />
              <img src="/screens/app-feed.webp" alt="Лента стажировок в мини-приложении ПрактикаПлюс" className="w-full rounded-[34px]" />
            </div>
            <div className="absolute -left-6 top-4 hidden w-60 rounded-2xl bg-white/95 p-3.5 text-sm shadow-xl ring-1 ring-slate-200 backdrop-blur sm:block">
              <p className="flex items-center gap-2 font-semibold text-slate-900"><BadgeCheck className="h-4 w-4 text-emerald-600" />Куратор подтвердил «Linux»</p>
              <p className="mt-1 text-xs text-slate-500">Индекс по 3 стажировкам вырос до 100%</p>
            </div>
            <div className="absolute -right-6 bottom-20 hidden w-64 rounded-2xl bg-white/95 p-3.5 text-sm shadow-xl ring-1 ring-slate-200 backdrop-blur sm:block">
              <p className="flex items-center gap-2 font-semibold text-slate-900"><MessageCircle className="h-4 w-4 text-blue-700" />Бот ПрактикаПлюс</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">ИнтерТех Интегратор приглашает вас на следующий этап 🎉</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
