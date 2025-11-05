'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';

export const SupabaseProvider = ({
  children,
  initialSession: _initialSession
}: {
  children: React.ReactNode;
  initialSession: Session | null;
}) => {
  const [_supabase] = useState(() => createSupabaseBrowserClient());

  return <>{children}</>;
};
