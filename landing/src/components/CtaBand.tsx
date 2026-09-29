import { ArrowUpRight, MessageCircle } from "lucide-react";
import { BOT_URL, LK_URL } from "../config";
import Container from "./ui/Container";
import Reveal from "./ui/Reveal";

export default function CtaBand() {
  return (
    <section className="bg-white pb-24">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] px-8 py-16 text-white sm:px-14 sm:py-20">
            <img src="/illustrations/city.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 via-blue-900/70 to-violet-900/40" />
            <div className="relative max-w-xl">
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Первая стажировка начинается с одного нажатия в MAX</h2>
              <p className="mt-4 text-base leading-7 text-white/80">Студентам — мини-приложение в мессенджере. Вузам и компаниям — общий кабинет. Для всех — бесплатно.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={BOT_URL} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-[15px] font-bold text-blue-800 transition hover:bg-blue-50"><MessageCircle className="h-5 w-5" />Я студент</a>
                <a href={LK_URL} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-6 py-3.5 text-[15px] font-bold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20">Я из вуза или компании<ArrowUpRight className="h-5 w-5" /></a>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
