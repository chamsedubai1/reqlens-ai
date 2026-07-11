import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand/Logo";
import { PasswordField } from "@/components/PasswordField";
import {
  MailIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendingUpIcon,
  BriefcaseIcon,
  BarChartIcon,
} from "@/components/icons";

const FEATURES = [
  {
    Icon: TrendingUpIcon,
    tile: "bg-brand-100 text-brand",
    title: "Improve story quality",
    body: "AI-powered scoring and actionable insights help you write better user stories.",
  },
  {
    Icon: BriefcaseIcon,
    tile: "bg-accent-light text-accent-dark",
    title: "Use business-domain knowledge",
    body: "Leverage domain-aware intelligence tailored to your business context.",
  },
  {
    Icon: BarChartIcon,
    tile: "bg-violet-100 text-violet-600",
    title: "Track BA performance over time",
    body: "Monitor improvement trends and drive continuous growth.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Left: marketing panel */}
      <aside className="relative hidden overflow-hidden bg-brand-mesh bg-blue-50/40 p-12 lg:flex lg:flex-col lg:justify-center">
        {/* decorative shapes */}
        <div className="pointer-events-none absolute -right-24 top-16 h-72 w-72 rounded-full border border-brand/10" />
        <div
          className="pointer-events-none absolute right-12 bottom-16 h-40 w-40 rounded-full opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #2563eb 1.4px, transparent 1.6px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative z-10 max-w-md">
          <Logo tagline size="lg" />

          <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white/70 px-4 py-1.5 text-sm font-semibold text-brand shadow-sm backdrop-blur">
            <SparklesIcon className="h-4 w-4" />
            Domain-aware AI for agile teams
          </div>

          <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-ink">
            Welcome back
          </h1>
          <p className="mt-4 max-w-sm text-lg text-slate-600">
            Review, score, and improve user stories with domain-aware AI intelligence.
          </p>

          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ Icon, tile, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold text-ink">{title}</div>
                  <p className="mt-0.5 max-w-xs text-sm text-slate-600">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Right: sign-in card */}
      <section className="flex items-center justify-center bg-brand-mesh bg-slate-50 px-6 py-12 sm:px-10 lg:bg-none lg:bg-white">
        <div className="w-full max-w-md">
          {/* mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo size="md" />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-card sm:p-10">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand ring-8 ring-brand-50/50">
                <ShieldCheckIcon className="h-7 w-7" />
              </span>
              <h2 className="mt-5 text-2xl font-bold text-ink">Sign in to your account</h2>
              <p className="mt-1 text-sm text-slate-500">
                Secure access to your ReqLens AI workspace
              </p>
            </div>

            {error && (
              <p className="mt-6 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            <form action={loginAction} className="mt-7 space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-semibold text-slate-700">
                  Work email
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                    <MailIcon className="h-5 w-5" />
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <a href="#" className="text-sm font-medium text-brand hover:text-brand-dark">
                    Forgot password?
                  </a>
                </div>
                <PasswordField />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-brand px-5 py-3 font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/20"
              >
                Log in
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-brand hover:text-brand-dark">
                Sign up
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-light text-accent-dark">
                <ShieldCheckIcon className="h-4 w-4" />
              </span>
              <div className="text-xs text-slate-500">
                <div className="font-semibold text-slate-700">
                  Your data is encrypted and secure
                </div>
                We never share your information with third parties.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
