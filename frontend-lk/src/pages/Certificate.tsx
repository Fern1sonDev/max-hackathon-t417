import { BadgeCheck, Loader2, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getCertificate, type Certificate as CertificateData } from "../lib/api";

export default function Certificate() {
  const { studentId, skillId, token } = useParams();
  const [data, setData] = useState<CertificateData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!studentId || !skillId || !token) {
      setNotFound(true);
      return;
    }
    getCertificate(studentId, skillId, token).then(setData).catch(() => setNotFound(true));
  }, [studentId, skillId, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-10">
      {notFound ? (
        <div className="card w-full max-w-sm p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><ShieldX className="h-6 w-6 text-slate-400" /></span>
          <h1 className="mt-4 text-lg font-bold text-slate-900">Сертификат не найден</h1>
          <p className="mt-1 text-sm text-slate-500">Ссылка недействительна или куратор снял подтверждение навыка.</p>
        </div>
      ) : !data ? (
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      ) : (
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl shadow-blue-900/10 ring-1 ring-slate-200">
          <div className="relative bg-brand px-8 pb-10 pt-8 text-white">
            <div className="flex items-center gap-2"><img src="/logo-mark.svg" alt="" className="h-8 w-8 rounded-lg ring-2 ring-white/30" /><span className="font-extrabold tracking-tight">ПрактикаПлюс</span></div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Цифровой сертификат · подтверждённая компетенция</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{data.skill}</h1>
            <span className="absolute -bottom-7 right-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-lg"><BadgeCheck className="h-8 w-8" /></span>
          </div>
          <dl className="grid gap-4 px-8 py-8 text-sm">
            <div><dt className="text-xs text-slate-400">Студент</dt><dd className="mt-0.5 text-base font-bold text-slate-900">{data.student_name}</dd></div>
            <div><dt className="text-xs text-slate-400">Вуз</dt><dd className="mt-0.5 font-semibold text-slate-900">{data.university}</dd></div>
            <div className="grid grid-cols-2 gap-4">
              <div><dt className="text-xs text-slate-400">Подтвердил(а)</dt><dd className="mt-0.5 font-semibold text-slate-900">{data.verified_by_name}</dd></div>
              <div><dt className="text-xs text-slate-400">Дата</dt><dd className="mt-0.5 font-semibold text-slate-900">{new Date(data.verified_at).toLocaleDateString("ru-RU")}</dd></div>
            </div>
            {data.comment && <div><dt className="text-xs text-slate-400">Основание</dt><dd className="mt-0.5 rounded-xl bg-emerald-50 px-3 py-2 font-medium text-emerald-900">{data.comment}</dd></div>}
          </dl>
          <p className="border-t border-slate-100 px-8 py-4 text-xs text-slate-400">Подлинность подтверждается подписанной ссылкой: если куратор снимет подтверждение, сертификат перестанет открываться.</p>
        </div>
      )}
    </div>
  );
}
