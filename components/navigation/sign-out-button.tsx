'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export const SignOutButton = () => {
  const router = useRouter();
  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <Button variant="ghost" className="px-0 text-sm" onClick={handleSignOut}>
      Sign out
    </Button>
  );
};
