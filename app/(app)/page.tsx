import { getAuthenticatedUser } from '@/lib/auth';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export default async function DashboardPage() {
  // SECURITY: Require authentication
  await getAuthenticatedUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Track team performance, conversion rates, and quote pipeline
        </p>
      </div>
      <DashboardView />
    </div>
  );
}
