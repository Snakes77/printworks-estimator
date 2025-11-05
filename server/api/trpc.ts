import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { cookies } from 'next/headers';
import { createSupabaseRouteClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const createTRPCContext = async () => {
  const cookieStore = await cookies();
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // SECURITY: Require authentication - NO demo user fallback
  if (!user || !user.id) {
    // Return context without user - protectedProcedure will handle rejection
    return {
      supabase,
      prisma,
      user: null,
      cookies: []
    };
  }

  // Extract authentication cookies for PDF generation
  const authCookies = cookieStore.getAll().map(cookie => ({
    name: cookie.name,
    value: cookie.value
  }));

  return {
    supabase,
    prisma,
    user: user,
    cookies: authCookies
  };
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.user.id) {
    throw new TRPCError({ 
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.'
    });
  }

  return next({
    ctx: {
      user: ctx.user,
      prisma: ctx.prisma,
      supabase: ctx.supabase,
      cookies: ctx.cookies
    }
  });
});
