// Inline SVG charts — no charting dependency, CSP-safe, theme-neutral.

export function Donut({
  segments,
}: {
  segments: { value: number; color: string }[];
}) {
  const size = 160;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-40 w-40">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}

export function LineTrend({ points }: { points: { date: string; score: number }[] }) {
  const w = 560;
  const h = 200;
  const pad = 28;
  if (points.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-slate-400">No data yet</div>;
  }
  const n = Math.max(points.length - 1, 1);
  const xs = points.map((_, i) => pad + (i / n) * (w - 2 * pad));
  const ys = points.map((p) => h - pad - (p.score / 100) * (h - 2 * pad));
  const line = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${h - pad} L${xs[0].toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[0, 25, 50, 75, 100].map((g) => {
        const y = h - pad - (g / 100) * (h - 2 * pad);
        return (
          <g key={g}>
            <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={4} y={y + 3} fontSize="9" fill="#94a3b8">{g}</text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trendFill)" />
      <path d={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="3" fill="#fff" stroke="#2563eb" strokeWidth="2" />
      ))}
    </svg>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 36;
  if (values.length < 2) return <div className="h-9" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = values.length - 1;
  const pts = values.map((v, i) => `${(i / n) * w},${h - ((v - min) / span) * (h - 4) - 2}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full">
      <polyline points={pts.join(" ")} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Grouped bars: first vs final per project.
export function GroupedBars({
  data,
}: {
  data: { label: string; first: number; final: number }[];
}) {
  if (data.length === 0) return <div className="flex h-40 items-center justify-center text-sm text-slate-400">No data yet</div>;
  return (
    <div className="flex items-end gap-4 overflow-x-auto pt-2">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-[64px] flex-1 flex-col items-center gap-2">
          <div className="flex h-40 items-end gap-1.5">
            <div className="relative h-40 w-5">
              <div className="absolute bottom-0 w-5 rounded-t bg-slate-300" style={{ height: `${d.first}%` }} />
            </div>
            <div className="relative h-40 w-5">
              <div className="absolute bottom-0 w-5 rounded-t bg-brand" style={{ height: `${d.final}%` }} />
            </div>
          </div>
          <div className="text-center text-[11px]">
            <div className="font-semibold">
              <span className="text-slate-400">{d.first}</span> · <span className="text-brand">{d.final}</span>
            </div>
            <div className="max-w-[72px] truncate text-slate-500">{d.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function heatColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-100 text-emerald-800";
  if (pct >= 65) return "bg-lime-100 text-lime-800";
  if (pct >= 50) return "bg-amber-100 text-amber-800";
  if (pct >= 35) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}
