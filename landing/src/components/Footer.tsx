import { Link } from "react-router-dom";
import Logo from "./Logo";
import Container from "./ui/Container";

const YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <Container className="flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">Стажировки по навыкам, подтверждённым вузом. Мини-приложение и бот в мессенджере MAX, кабинет для вузов и компаний.</p>
        </div>
        <nav aria-label="Документы" className="flex flex-col gap-2.5 text-sm text-slate-600 sm:items-end">
          <Link to="/offer" className="hover:text-blue-700">Условия использования</Link>
          <Link to="/privacy" className="hover:text-blue-700">Политика обработки данных</Link>
          <Link to="/consent" className="hover:text-blue-700">Согласие на обработку</Link>
        </nav>
      </Container>
      <Container className="border-t border-slate-200 py-5 text-xs leading-5 text-slate-400">
        © {YEAR} ПрактикаПлюс · проект команды t417 для хакатона MAX, трек «Образовательные решения». Примеры на странице — учебные; компании, вузы и студенты в демо-режиме вымышлены.
      </Container>
    </footer>
  );
}
