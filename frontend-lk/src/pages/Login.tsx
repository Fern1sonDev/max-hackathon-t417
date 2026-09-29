import { Loader2, LogIn } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { humanError, login } from "../lib/api";
import AuthShell from "../components/AuthShell";

const DEMO = [
  { label: "Вуз · администратор", email: "curator@skfu.example" },
  { label: "Вуз · куратор группы", email: "curator2@skfu.example" },
  { label: "Компания · HR-директор", email: "hr@intertech.example" },
  { label: "Компания · рекрутер", email: "recruiter@intertech.example" },
];

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      onLoggedIn();
    } catch (err) {
      setError(humanError(err, "Не удалось войти, попробуйте ещё раз"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Вход в кабинет</h2>
      <p className="mt-1.5 text-sm text-slate-500">Для кураторов вузов и работодателей. Студенты работают в мини-приложении MAX.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="label">Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.ru" className="field" /></label>
        <label className="label">Пароль<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" /></label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy || !email.trim() || !password} className="btn-primary w-full py-3">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{busy ? "Входим…" : "Войти"}</button>
      </form>
      <div className="mt-6 rounded-2xl bg-slate-100/80 p-4">
        <p className="text-xs font-semibold text-slate-600">Демо-доступ для проверки (пароль demo12345)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMO.map((d) => <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword("demo12345"); }} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-slate-200 hover:ring-blue-300">{d.label}</button>)}
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">Нет аккаунта? <Link to="/register" className="font-semibold text-blue-700 hover:text-blue-800">Зарегистрировать организацию</Link></p>
    </AuthShell>
  );
}
