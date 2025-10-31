import type { Session } from '@supabase/supabase-js';
import { TRPCReactProvider } from '@/components/providers/trpc-provider';
import { SupabaseProvider } from '@/components/providers/supabase-provider';

export const AppProviders = ({
  children,
  initialSession
}: {
  children: React.ReactNode;
  initialSession: Session | null;
}) => {
  return (
    <SupabaseProvider initialSession={initialSession}>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </SupabaseProvider>
  );
};
