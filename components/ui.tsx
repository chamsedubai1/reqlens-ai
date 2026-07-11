import { clsx } from "@/lib/cx";

// Shared field styling (inputs, selects, textareas).
export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/25 transition hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/20";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("rounded-2xl border border-slate-100 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES: Record<string, string> = {
  brand: "bg-brand-50 text-brand",
  slate: "bg-slate-100 text-slate-600",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
};

export function Badge({
  tone = "slate",
  children,
}: {
  tone?: keyof typeof TONES | string;
  children: React.ReactNode;
}) {
  return (
    <span className={clsx("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone] ?? TONES.slate)}>
      {children}
    </span>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
      {message}
    </p>
  );
}

export function readinessTone(status: string): keyof typeof TONES {
  if (status === "Excellent" || status === "Ready") return "green";
  if (status === "Needs Improvement") return "amber";
  if (status === "Not Ready") return "red";
  return "slate";
}
