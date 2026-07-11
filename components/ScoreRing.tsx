// Pure inline-SVG score ring (0–100). No external chart dependency (CSP-safe).
export function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = clamped >= 80 ? "#16a34a" : clamped >= 65 ? "#d97706" : "#dc2626";
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 50 50)"
      />
      <text x="50" y="49" textAnchor="middle" className="fill-slate-900" fontSize="20" fontWeight="700">
        {clamped}
      </text>
      <text x="50" y="64" textAnchor="middle" className="fill-slate-400" fontSize="9">/ 100</text>
    </svg>
  );
}
