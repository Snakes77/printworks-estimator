import { getAuthenticatedUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SettingsPage() {
  // SECURITY: Require authentication
  const user = await getAuthenticatedUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage your account settings and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <p className="text-sm text-slate-600">{user.email}</p>
          </div>
          {user.name && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <p className="text-sm text-slate-600">{user.name}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            PrintWorks Estimator - Fast, accurate quoting for commercial print in one place.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

