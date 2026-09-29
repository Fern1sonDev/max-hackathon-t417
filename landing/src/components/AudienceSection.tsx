import { Check } from "lucide-react";
import { AUDIENCES } from "../data/audiences";
import Container from "./ui/Container";
import Reveal from "./ui/Reveal";
import SectionHeading from "./ui/SectionHeading";

export default function AudienceSection() {
  return (
    <section id="roles" className="bg-white py-24 sm:py-28">
      <Container>
        <SectionHeading eyebrow="Для кого" title="Одна платформа — три роли" description="Приоритетный сегмент — студенты 2–4 курсов технических вузов, которым нужна производственная практика или первая стажировка в своём регионе." />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.title} delayMs={i * 90}>
              <article className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-slate-200 transition hover:shadow-2xl hover:shadow-blue-900/10">
                <div className={`relative flex h-64 items-end justify-center overflow-hidden ${a.bg}`}>
                  <img src={a.image} alt="" className="h-60 w-auto drop-shadow-lg transition duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 shadow-sm">{a.channel}</span>
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <h3 className="text-lg font-bold text-slate-900">{a.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{a.description}</p>
                  <ul className="mt-5 space-y-2.5">
                    {a.points.map((p) => <li key={p} className="flex gap-2.5 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />{p}</li>)}
                  </ul>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
