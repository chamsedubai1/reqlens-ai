import { getCurrentProfile } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        Welcome back, {profile?.fullName} 👋
      </h1>
      <p className="mt-2 text-slate-600">
        Your ReqLens AI dashboard. KPI cards and your stories will appear here.
      </p>
    </div>
  );
}
