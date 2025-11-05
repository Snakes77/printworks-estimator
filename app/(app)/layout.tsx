import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // SECURITY: Require authentication - NO bypass
  if (!user) {
    redirect('/login');
  }

  // Note: PDF routes are now outside (app) route group at app/quotes/[id]/pdf
  // They bypass AppShell automatically by not being in this layout
  return <AppShell user={{ email: user.email ?? '', name: user.user_metadata?.full_name ?? null }}>{children}</AppShell>;
}
