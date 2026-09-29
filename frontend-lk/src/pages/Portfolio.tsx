import { Award, BadgeCheck, ClipboardCheck, Clock3, ExternalLink, GraduationCap, Handshake, Loader2, Mail, MapPin, ShieldX, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, formatDate, type Portfolio as PortfolioData } from "../lib/api";
import { Avatar } from "../components/ui";

export default function Portfolio() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.portfolio(token).then((p) => { setData(p); document.title = `${p.name} — визитка ПрактикаПлюс`; }).catch(() => setNotFound(true));
  }, [token]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><ShieldX className="h-6 w-6 text-slate-400" /></span>
          <h1 className="mt-4 text-lg font-bold text-slate-900">Визитка недоступна</h1>
          <p className="mt-1 text-sm text-slate-500">Студент скрыл страницу или ссылка устарела.</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;

  const place = [data.city, data.region].filter(Boolean).join(", ");
  return (
    <div className="min-h-screen bg-[#f5f7fb] pb-16">
      <header className="relative overflow-hidden bg-brand px-5 pb-24 pt-6 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="mx-auto flex max-w-3xl items-center gap-2"><img src="/logo-mark.svg" alt="" className="h-8 w-8 rounded-lg ring-2 ring-white/30" /><span className="font-extrabold tracking-tight">ПрактикаПлюс</span><span className="ml-auto text-xs font-semibold text-white/75">Визитка студента</span></div>
      </header>
      <main className="mx-auto -mt-16 max-w-3xl space-y-4 px-4">
        <section className="card p-6">
          <div className="flex flex-wrap items-center gap-5">
            <Avatar name={data.name} size={88} src={data.avatar_url} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{data.name}</h1>
              {data.university && <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><GraduationCap className="h-4 w-4 text-blue-700" />{data.university}{data.group ? ` · ${data.group}` : ""}</p>}
              {place && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-4 w-4" />{place}</p>}
              {data.contact && <p className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800"><Mail className="h-4 w-4" />{data.contact}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-emerald-50 px-4 py-3"><p className="text-2xl font-extrabold tabular text-emerald-700">{data.verified.length}</p><p className="text-[11px] font-semibold text-emerald-800">подтверждено вузом</p></div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3"><p className="text-2xl font-extrabold tabular text-amber-700">{data.points}</p><p className="text-[11px] font-semibold text-amber-800">баллов активности</p></div>
            </div>
          </div>
        </section>

        {data.verified.length > 0 && (
          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><BadgeCheck className="h-5 w-5 text-emerald-600" />Навыки, подтверждённые вузом</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.verified.map((s) => (
                <article key={s.skill_id} className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                  <Award className="absolute -right-3 -top-3 h-16 w-16 text-emerald-100" />
                  <p className="relative font-bold text-slate-900">{s.name}</p>
                  {s.comment && <p className="relative mt-1 text-xs text-emerald-900">Основание: {s.comment}</p>}
                  <p className="relative mt-2 text-[11px] text-slate-500">{s.reviewed_by ? `${s.reviewed_by} · ` : ""}{s.reviewed_at ? formatDate(s.reviewed_at, false) : ""}</p>
                  {data.certificate_urls[s.name] && <a href={data.certificate_urls[s.name]} target="_blank" rel="noreferrer" className="relative mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"><ExternalLink className="h-3.5 w-3.5" />Цифровой сертификат</a>}
                </article>
              ))}
            </div>
          </section>
        )}

        {(data.employer_review.length > 0 || data.claimed.length > 0 || data.tests_passed.length > 0) && (
          <section className="card grid gap-5 p-6 sm:grid-cols-2">
            {data.tests_passed.length > 0 && (
              <div className="sm:col-span-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ClipboardCheck className="h-4 w-4 text-blue-700" />Пройденные тесты вуза</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">{data.tests_passed.map((t) => <span key={t} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{t}</span>)}</div>
              </div>
            )}
            {data.employer_review.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Handshake className="h-4 w-4 text-violet-600" />На усмотрение работодателя</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">{data.employer_review.map((s) => <span key={s.skill_id} title={s.comment} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">{s.name}</span>)}</div>
              </div>
            )}
            {data.claimed.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Clock3 className="h-4 w-4 text-blue-600" />Заявлены студентом</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">{data.claimed.map((s) => <span key={s} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-inset ring-blue-200">{s}</span>)}</div>
              </div>
            )}
          </section>
        )}

        <p className="flex items-center justify-center gap-1.5 px-4 text-center text-xs text-slate-400"><Trophy className="h-3.5 w-3.5" />Зелёные навыки подтверждены куратором вуза в ПрактикаПлюс — сервисе стажировок в MAX</p>
      </main>
    </div>
  );
}
