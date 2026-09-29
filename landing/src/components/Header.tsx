import { LogIn, MessageCircle } from "lucide-react";
import { BOT_URL, LK_URL } from "../config";
import Logo from "./Logo";
import Container from "./ui/Container";

const LINKS = [
  { href: "#how", label: "Как это работает" },
  { href: "#index", label: "Индекс соответствия" },
  { href: "#max", label: "В MAX" },
  { href: "#roles", label: "Для кого" },
  { href: "#questions", label: "Вопросы" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
      <Container className="flex h-[72px] items-center justify-between gap-6">
        <a href="/" aria-label="ПрактикаПлюс"><Logo compact /></a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 xl:flex">
          {LINKS.map((l) => <a key={l.href} href={l.href} className="whitespace-nowrap transition hover:text-blue-700">{l.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <a href={LK_URL} className="hidden items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:inline-flex"><LogIn className="h-4 w-4" />Вуз и компания</a>
          <a href={BOT_URL} className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lift transition hover:bg-blue-800"><MessageCircle className="h-4 w-4" />Открыть в MAX</a>
        </div>
      </Container>
    </header>
  );
}
