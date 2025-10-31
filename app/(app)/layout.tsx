import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  // TEMPORARY: Bypass auth for demo
  // if (!session) {
  //   redirect('/login');
  // }

  const profile = session?.user;

  return <AppShell user={{ email: profile?.email ?? 'demo@example.com', name: profile?.user_metadata?.full_name ?? 'Demo User' }}>{children}</AppShell>;
}
