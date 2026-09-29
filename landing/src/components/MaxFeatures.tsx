import { Bell, Link2, Phone, ShieldCheck, Share2, Undo2 } from "lucide-react";
import Container from "./ui/Container";
import Reveal from "./ui/Reveal";
import SectionHeading from "./ui/SectionHeading";

const FEATURES = [
  { icon: Bell, title: "Бот — канал событий", text: "Вопросы задания после отклика, сводка проверки навыков, приглашение со следующим шагом, стажировки с индексом от 60%." },
  { icon: Link2, title: "Ссылка группы", text: "max.ru/…?startapp=g_<код> открывает мини-приложение с вузом, группой и городом, закреплёнными за студентом." },
  { icon: Undo2, title: "Решение без спешки", text: "Приглашение или отказ уходит студенту через 90 секунд — работодатель успевает отменить ошибочный клик." },
  { icon: Share2, title: "Поделиться в MAX", text: "Стажировку, сертификат навыка или визитку студента можно отправить в чат MAX одним нажатием." },
  { icon: Phone, title: "Контакт и фото из MAX", text: "Телефон — в один тап с разрешения студента, аватар — из профиля MAX. Без ручного ввода." },
  { icon: ShieldCheck, title: "Бот не для всех", text: "Отвечает только зарегистрированным студентам и тем, кто пришёл по действующей ссылке вуза." },
];

const CHAT = [
  { me: false, text: "Вы откликнулись на «Стажёр по сетевой инфраструктуре». Индекс: 100%.\n\nТестовое задание (2 вопроса):\n1. Соединение есть, а ресурс недоступен — какие три проверки?\n2. Как задокументируете площадку в NetBox?" },
  { me: true, text: "1) маршрут, правила МЭ и NAT, DNS в туннеле 2) Site, стойки, устройства, префиксы и VLAN" },
  { me: false, text: "Ответ передан компании. Решение придёт сюда же. Статус — /status." },
  { me: false, text: "🎉 ИнтерТех Интегратор приглашает вас на следующий этап.\nЧто дальше: онлайн-собеседование\nКогда: четверг, 11:00\nКонтакт: Елена Смирнова · +7 900 200-00-01" },
];

export default function MaxFeatures() {
  return (
    <section id="max" className="bg-slate-50 py-24 sm:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <div className="mx-auto w-full max-w-sm rounded-[36px] bg-white p-4 shadow-2xl shadow-blue-900/10 ring-1 ring-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-100 px-2 pb-3">
              <img src="/logo-mark.svg" alt="" className="h-10 w-10" />
              <div><p className="text-sm font-bold text-slate-900">ПрактикаПлюс</p><p className="text-xs text-emerald-600">бот · в сети</p></div>
            </div>
            <div className="space-y-2.5 px-1 py-4">
              {CHAT.map((m, i) => (
                <p key={i} className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 ${m.me ? "ml-auto rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-slate-100 text-slate-800"}`}>{m.text}</p>
              ))}
              <div className="flex gap-2 pt-1"><span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Открыть ПрактикаПлюс</span><span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Мои отклики</span></div>
            </div>
          </div>
        </Reveal>
        <div>
          <SectionHeading align="left" eyebrow="Сделано для MAX" title="Чат — для коротких действий, мини-приложение — для выбора" description="Как рекомендует платформа: в чате — статусы, уведомления и ответы в одну строку; в мини-приложении — каталог, сравнение стажировок и формы." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delayMs={i * 50}>
                <div className="h-full rounded-2xl bg-white p-5 ring-1 ring-slate-200/70">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-[18px] w-[18px]" /></span>
                  <p className="mt-3 font-bold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
