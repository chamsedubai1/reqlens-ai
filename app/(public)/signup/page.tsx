import { signupAction } from "@/app/actions/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold text-brand">Create your ReqLens AI workspace</h1>
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
      <form action={signupAction} className="flex flex-col gap-4">
        <input name="fullName" required placeholder="Full name" className="rounded-lg border border-slate-300 px-4 py-2.5" />
        <input name="tenantName" required placeholder="Organization name" className="rounded-lg border border-slate-300 px-4 py-2.5" />
        <input name="email" type="email" required placeholder="Email" className="rounded-lg border border-slate-300 px-4 py-2.5" />
        <input name="password" type="password" required minLength={8} placeholder="Password (min 8 characters)" className="rounded-lg border border-slate-300 px-4 py-2.5" />
        <button type="submit" className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark">
          Create workspace
        </button>
      </form>
      <p className="text-sm text-slate-600">
        Already have an account?{" "}
        <a href="/login" className="text-brand hover:underline">
          Log in
        </a>
      </p>
    </main>
  );
}
