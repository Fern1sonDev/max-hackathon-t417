import { BookOpen, CheckCircle2, ExternalLink, KeyRound, Loader2, Plug, ShieldCheck, Unplug } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, formatDate, humanError, type Integration, type Profile } from "../lib/api";
import ErrorState from "../components/ErrorState";
import { Modal, Skeleton, useToast } from "../components/ui";

const TONE: Record<string, string> = {
  ats: "from-blue-600 to-indigo-700",
  jobboard: "from-rose-500 to-red-600",
  gov: "from-sky-600 to-blue-800",
  lms: "from-amber-500 to-orange-600",
  erp: "from-yellow-500 to-amber-600",
};

function ConnectModal({ item, onClose, onSaved }: { item: Integration; onClose: () => void; onSaved: (i: Integration) => void }) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(item.fields.map((f) => [f.key, f.secret ? "" : item.settings[f.key] ?? ""])));
  const [busy, setBusy] = useState(false);
  const ready = item.fields.every((f) => !f.required || values[f.key]?.trim());

  async function save() {
    setBusy(true);
    try {
      onSaved(await api.connectIntegration(item.id, values));
      toast("success", `${item.name}: подключение сохранено`);
    } catch (e) {
      toast("error", humanError(e, "Не удалось сохранить подключение"));
    } finally { setBusy(false); }
  }

  return (
    <Modal title={`Подключить ${item.name}`} onClose={onClose} footer={
      <div className="flex items-center justify-between gap-3">
        <a href={item.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"><BookOpen className="h-3.5 w-3.5" />Документация API</a>
        <button onClick={save} disabled={busy || !ready} className="btn-primary">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}Подключить</button>
      </div>
    }>
      <p className="text-sm leading-6 text-slate-600">{item.summary}</p>
      <p className="mt-2 text-xs text-slate-500">Авторизация: {item.auth}</p>
      <div className="mt-4 space-y-3">
        {item.fields.map((f) => (
          <label key={f.key} className="label">{f.label}{!f.required && <span className="font-normal text-slate-400"> — необязательно</span>}
            <input type={f.secret ? "password" : "text"} autoComplete="off" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.secret && item.settings[f.key] ? `сохранён: ${item.settings[f.key]}` : f.placeholder} maxLength={300} className="field" />
          </label>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Секретные ключи не сохраняются: сервис проверяет их наличие и хранит только маску из последних четырёх символов.</p>
    </Modal>
  );
}

export default function Integrations({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [items, setItems] = useState<Integration[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Integration | null>(null);

  function load() {
    setError("");
    api.integrations().then(setItems).catch((e) => setError(humanError(e, "Не удалось загрузить интеграции")));
  }
  useEffect(load, []);

  const groups = useMemo(() => {
    const map = new Map<string, Integration[]>();
    (items ?? []).forEach((i) => map.set(i.category_label, [...(map.get(i.category_label) ?? []), i]));
    return Array.from(map.entries());
  }, [items]);

  async function disconnect(item: Integration) {
    try {
      await api.disconnectIntegration(item.id);
      setItems((list) => list && list.map((i) => (i.id === item.id ? { ...i, connected: false, status: null, status_label: "", settings: {}, connected_at: null } : i)));
      toast("success", `${item.name} отключён`);
    } catch (e) {
      toast("error", humanError(e, "Не удалось отключить"));
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Интеграции</h1>
      <p className="page-sub">{profile.role === "hr" ? "Выгружайте приглашённых кандидатов в свою ATS и публикуйте стажировки на площадках — без двойного ввода." : "Подключите ЭИОС и учётную систему вуза: студенты, группы и результаты практик — без ручного переноса."}</p>

      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-blue-50/70 p-4 text-sm text-slate-700 ring-1 ring-blue-100">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <p>Коннекторы построены на публичных API систем (ссылки на документацию — в карточках). На этапе MVP сохраняются настройки подключения; синхронизация данных включается на пилоте с конкретной организацией.</p>
      </div>

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}
      {!error && !items && <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>}

      {groups.map(([label, list]) => (
        <section key={label} className="mt-7">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">{label}</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((i) => (
              <article key={i.id} className={`card flex flex-col p-5 ${i.connected ? "ring-2 ring-emerald-200" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-extrabold text-white ${TONE[i.category] ?? "from-slate-500 to-slate-700"}`}>{i.vendor.replace(/[^A-Za-zА-Яа-я0-9]/g, "").slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900">{i.name}</h3>
                    <p className="text-xs text-slate-500">{i.vendor}</p>
                  </div>
                  {i.connected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" />Подключено</span>}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{i.summary}</p>
                <ul className="mt-3 space-y-1 text-xs text-slate-600">{i.capabilities.map((c) => <li key={c} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />{c}</li>)}</ul>
                {i.connected && <p className="mt-3 rounded-xl bg-emerald-50/70 p-2.5 text-[11px] leading-4 text-emerald-800">{i.status_label}{i.connected_at ? ` · с ${formatDate(i.connected_at, false)}` : ""}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <a href={i.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-700"><ExternalLink className="h-3.5 w-3.5" />API</a>
                  <div className="flex gap-2">
                    {i.connected && <button onClick={() => disconnect(i)} className="btn-secondary px-3 py-2 text-xs"><Unplug className="h-3.5 w-3.5" />Отключить</button>}
                    <button onClick={() => setOpen(i)} className={i.connected ? "btn-secondary px-3 py-2 text-xs" : "btn-primary px-3 py-2 text-xs"}><Plug className="h-3.5 w-3.5" />{i.connected ? "Настроить" : "Подключить"}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {open && <ConnectModal item={open} onClose={() => setOpen(null)} onSaved={(u) => { setItems((list) => list && list.map((x) => (x.id === u.id ? u : x))); setOpen(null); }} />}
    </div>
  );
}
