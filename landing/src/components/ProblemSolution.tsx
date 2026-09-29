import Container from "./ui/Container";
import Reveal from "./ui/Reveal";
import SectionHeading from "./ui/SectionHeading";

const FACTS = [
  { value: "≈5 млн", label: "студентов вузов в 2025/26 учебном году — у каждого обязательная практическая подготовка", source: "Правительство РФ, 27.08.2025; приказ № 885/390" },
  { value: "64%", label: "молодых специалистов называют главным барьером при поиске работы отсутствие опыта", source: "SuperJob, опрос 500 выпускников 2023–2025, 09.2026" },
  { value: "57%", label: "соискателей сталкивались с тем, что работодатель просто не отвечает на отклик", source: "ВЦИОМ, 1 601 респондент, 06.2026" },
  { value: "50%", label: "«поколения цифры» (2001 г. р. и младше) получают молчание в ответ на резюме постоянно или часто", source: "ВЦИОМ, 06.2026" },
];

const ASIS = [
  ["Студент", "ищет практику по чатам кафедры и сайтам вакансий, «навыки» в резюме никто не проверяет"],
  ["Работодатель", "получает непроверяемые резюме, тратит время на первичный отсев, отвечает не всем"],
  ["Вуз", "не видит, кто куда откликнулся и где студент «застрял», — узнаёт об этом к отчёту по практике"],
];

const TOBE = [
  ["Студент", "видит индекс соответствия и чего не хватает, откликается в один тап, ответ получает в MAX"],
  ["Работодатель", "получает отклики с честным индексом, телефоном и ответами на задание — по каждой стажировке отдельно"],
  ["Вуз", "проверяет навыки группы одним сохранением и видит группу риска, работодателей региона и спрос на навыки"],
];

export default function ProblemSolution() {
  return (
    <section className="bg-slate-50 py-24 sm:py-28">
      <Container>
        <SectionHeading eyebrow="Проблема" title="Практику ищут вслепую, а отклики уходят в тишину" description="Студенту нужна практика по учебному плану, работодателю — стажёр с проверенными навыками, вузу — прозрачность. Сегодня между ними резюме «со слов» и отклики без ответа." />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((f, i) => (
            <Reveal key={f.value} delayMs={i * 70}>
              <div className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
                <p className="bg-gradient-to-br from-blue-600 to-violet-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">{f.value}</p>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-700">{f.label}</p>
                <p className="mt-4 text-[11px] leading-4 text-slate-400">Источник: {f.source}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl bg-white p-7 ring-1 ring-slate-200/70">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Как сейчас</p>
              <ul className="mt-4 space-y-3.5">{ASIS.map(([who, text]) => <li key={who} className="text-sm leading-6 text-slate-600"><b className="text-slate-900">{who}</b> {text}</li>)}</ul>
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <div className="h-full rounded-3xl bg-slate-950 p-7 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-300">С ПрактикаПлюс</p>
              <ul className="mt-4 space-y-3.5">{TOBE.map(([who, text]) => <li key={who} className="text-sm leading-6 text-slate-300"><b className="text-white">{who}</b> {text}</li>)}</ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
