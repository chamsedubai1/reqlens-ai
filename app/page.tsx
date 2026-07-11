export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold text-brand">ReqLens AI</h1>
      <p className="text-lg text-slate-600">
        Domain-Aware Requirements Intelligence — score, improve, and track the
        quality of your agile user stories.
      </p>
      <div className="flex gap-4">
        <a
          href="/signup"
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Get started
        </a>
        <a
          href="/login"
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-100"
        >
          Log in
        </a>
      </div>
    </main>
  );
}
