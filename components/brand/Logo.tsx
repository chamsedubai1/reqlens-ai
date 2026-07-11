import { clsx } from "@/lib/cx";

// ReqLens AI logo: a magnifying-glass-over-document mark (with a teal "reviewed"
// dot) plus the wordmark. Pure inline SVG — crisp at any size, no asset/CSP cost.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      {/* lens body */}
      <circle cx="21" cy="21" r="14" fill="#eff6ff" stroke="#2563eb" strokeWidth="3" />
      {/* document inside */}
      <rect x="15" y="13.5" width="12" height="15" rx="2" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.2" />
      <line x1="17.5" y1="17" x2="24.5" y2="17" stroke="#bfdbfe" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17.5" y1="20" x2="24.5" y2="20" stroke="#bfdbfe" strokeWidth="1.5" strokeLinecap="round" />
      {/* green check = "reviewed" */}
      <path d="M17.5 24.2l2 2 4-4.2" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* handle */}
      <line x1="31" y1="31" x2="41" y2="41" stroke="#2563eb" strokeWidth="4.5" strokeLinecap="round" />
      {/* accent dot */}
      <circle cx="38" cy="10" r="4" fill="#10b981" />
    </svg>
  );
}

export function Logo({
  className,
  tagline = false,
  size = "md",
}: {
  className?: string;
  tagline?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const mark = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const word = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <LogoMark className={mark} />
      <div className="leading-none">
        <div className={clsx("font-extrabold tracking-tight", word)}>
          <span className="text-ink">Req</span>
          <span className="text-brand">Lens</span>{" "}
          <span className="text-accent">AI</span>
        </div>
        {tagline && (
          <div className="mt-1 text-xs font-medium text-slate-500">
            Domain-Aware Requirements Intelligence
          </div>
        )}
      </div>
    </div>
  );
}
