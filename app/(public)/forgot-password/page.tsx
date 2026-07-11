import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ShieldCheckIcon } from "@/components/icons";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-mesh bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size="md" />
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-card sm:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand ring-8 ring-brand-50/50">
            <ShieldCheckIcon className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-ink">Reset your password</h1>
          <p className="mt-3 text-sm text-slate-600">
            Password resets are handled by your <span className="font-semibold text-slate-800">workspace admin</span>.
            Ask them to issue a new temporary password from the Admin page, then sign in and change it.
          </p>
          <div className="mt-6">
            <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
