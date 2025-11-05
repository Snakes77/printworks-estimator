import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensurePrismaUser } from '@/lib/app-user';

/**
 * Get authenticated user - redirects to login if not authenticated
 * SECURITY: No demo user fallback - authentication required
 */
export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.id) {
    redirect('/login');
  }

  const appUser = await ensurePrismaUser(user);
  return appUser;
}

/**
 * Verify quote ownership - throws error if user doesn't own quote
 */
export async function verifyQuoteOwnership(quoteId: string, userId: string) {
  const { prisma } = await import('@/lib/prisma');

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { userId: true }
  });

  if (!quote) {
    throw new Error('Quote not found');
  }

  if (quote.userId !== userId) {
    throw new Error('Access denied');
  }

  return true;
}

