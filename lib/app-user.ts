import type { User as SupabaseUser } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

export const ensurePrismaUser = async (user: SupabaseUser | null) => {
  if (!user?.id || !user.email) {
    throw new Error('Supabase user context missing. Please sign in again.');
  }

  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? null
    }
  });
};
