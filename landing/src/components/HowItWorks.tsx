import { BadgeCheck, BriefcaseBusiness, MessageCircleMore, QrCode } from "lucide-react";
import Container from "./ui/Container";
import Reveal from "./ui/Reveal";
import SectionHeading from "./ui/SectionHeading";

const STEPS = [
  { icon: QrCode, title: "Вуз приглашает группу", text: "У каждой группы свой QR-код и ссылка. Студент открывает мини-приложение в MAX — вуз, группа и город уже заполнены и закреплены." },
  { icon: BadgeCheck, title: "Вуз проверяет навыки", text: "Куратор отмечает решения по всем навыкам студента — подтвердить, «на усмотрение работодателя» или отклонить — и сохраняет один раз." },
  { icon: BriefcaseBusiness, title: "Отклик в один тап", text: "Лента сортируется по индексу соответствия. Вопросы тестового приходят в чат MAX — ответить можно обычным сообщением." },
  { icon: MessageCircleMore, title: "Решение и следующий шаг", text: "Компания работает с воронкой своей стажировки: приглашает с датой, адресом и контактом. Молчит 72 часа — бот предложит студенту альтернативы." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-slate-950 py-24 text-white sm:py-28">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-blue-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-3xl" />
      <Container className="relative">
        <SectionHeading eyebrow="Основной сценарий" title="От приглашения группы до оффера — четыре шага" description="Каждый участник делает свой шаг в одном процессе, без почты, таблиц и потерянных сообщений." light />
        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delayMs={i * 80}>
              <li className="h-full rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur transition hover:bg-white/[0.08]">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand shadow-lift"><Icon className="h-5 w-5" /></span>
                  <span className="text-sm font-bold tracking-widest text-white/30">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
