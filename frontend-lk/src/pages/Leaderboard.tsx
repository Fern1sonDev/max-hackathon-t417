import { ShieldCheck, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { humanError, api, type LeaderboardEntry } from "../lib/api";
import ErrorState from "../components/ErrorState";
import { Avatar, Empty, Skeleton } from "../components/ui";

const MEDAL = ["bg-amber-400 text-amber-950", "bg-slate-300 text-slate-800", "bg-orange-300 text-orange-950"];

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState("");

  function load() {
    setError("");
    api.leaderboard().then(setEntries).catch((e) => setError(humanError(e, "Не удалось загрузить витрину талантов")));
  }
  useEffect(load, []);

  return (
    <div className="page max-w-4xl">
      <h1 className="page-title">Витрина талантов</h1>
      <p className="page-sub">Баллы начисляются за навыки, подтверждённые вузом, пройденные тесты и активность в откликах.</p>

      {error && <div className="mt-8"><ErrorState message={error} onRetry={load} /></div>}
      {!error && entries === null && <div className="mt-6 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>}
      {!error && entries?.length === 0 && <div className="mt-6"><Empty icon={<Trophy className="h-6 w-6" />} title="Пока пусто" text="Витрина заполнится, когда студенты подтвердят первые навыки." /></div>}

      <div className="mt-6 space-y-2">
        {entries?.map((e, i) => (
          <div key={e.student_id} className="card flex items-center gap-4 p-4">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${MEDAL[i] ?? "bg-slate-100 text-slate-600"}`}>{i + 1}</span>
            <Avatar name={e.name} size={40} src={e.avatar_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-slate-900">{e.name}</p>
              <p className="truncate text-xs text-slate-500">{e.university}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" title="Подтверждённых навыков"><ShieldCheck className="h-3.5 w-3.5" />{e.verified_skills_count}</span>
            <span className="w-14 shrink-0 text-right text-lg font-extrabold tabular text-blue-700">{e.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
