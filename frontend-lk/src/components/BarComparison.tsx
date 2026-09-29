export interface ComparisonRow {
  label: string;
  a: number;
  b: number;
}

export default function BarComparison({
  rows,
  legendA,
  legendB,
}: {
  rows: ComparisonRow[];
  legendA: string;
  legendB: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-xs font-medium text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-700" />
          {legendA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          {legendB}
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 text-xs font-semibold text-slate-700">{row.label}</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-700" style={{ width: `${(row.a / max) * 100}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-600">{row.a}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(row.b / max) * 100}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-600">{row.b}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
