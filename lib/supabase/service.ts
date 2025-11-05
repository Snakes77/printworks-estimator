import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * SECURITY: Service role client for server-side operations
 * Bypasses RLS policies (server-side only, never exposed to client)
 */
export const createSupabaseServiceRoleClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations');
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

