import { Plus } from "lucide-react";
import Container from "./ui/Container";
import Reveal from "./ui/Reveal";
import SectionHeading from "./ui/SectionHeading";

const QUESTIONS = [
  { q: "Что именно подтверждает вуз?", a: "Куратор выносит по каждому навыку одно из трёх решений: подтвердить (с основанием — курсовой, хакатон, практика), «на усмотрение работодателя» или отклонить. Навык подтверждается и автоматически, если студент сдал тест вуза." },
  { q: "Как считается индекс, если вуз ещё не проверил навыки?", a: "Учитываются все навыки: подтверждённый вузом — полностью, «на усмотрение работодателя» — на 75%, заявленный — наполовину. Работодатель видит заявленные навыки синим, подтверждённые — зелёным и отдельную цифру «подтверждено вузом»." },
  { q: "Нужно ли студенту резюме?", a: "Нет. Профиль в мини-приложении MAX заполняется за минуту, а публичную визитку с сертификатами можно отправить любому работодателю ссылкой." },
  { q: "Что будет, если компания не ответит?", a: "Через 48 часов отклик подсвечивается в кабинете компании как просроченный, через 72 часа снимается автоматически, а бот присылает студенту похожие стажировки." },
  { q: "Кто видит мои данные?", a: "Куратор — студентов своего вуза. Работодатель — телефон и ответы только тех, кто откликнулся на его стажировки. Бот отвечает только зарегистрированным пользователям и тем, кто пришёл по действующей ссылке вуза." },
  { q: "Как начать пользоваться?", a: "Студенту — открыть бота в MAX и нажать «Открыть ПрактикаПлюс». Вузу и компании — зарегистрироваться в веб-кабинете, это бесплатно." },
];

export default function Questions() {
  return (
    <section id="questions" className="bg-white py-24 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <SectionHeading eyebrow="Частые вопросы" title="Коротко о главном" description="Если чего-то не нашли — напишите боту /help прямо в MAX." align="left" />
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {QUESTIONS.map(({ q, a }, i) => (
            <Reveal key={q} delayMs={i * 40}>
              <details className="group py-5" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left font-semibold text-slate-900 marker:hidden">
                  {q}<span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-blue-700 transition group-open:rotate-45"><Plus className="h-4 w-4" /></span>
                </summary>
                <p className="max-w-2xl pr-10 pt-3 text-sm leading-6 text-slate-600">{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
