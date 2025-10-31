import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { createSupabaseRouteClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const createTRPCContext = async () => {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return {
    supabase,
    prisma,
    user
  };
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      user: ctx.user,
      prisma: ctx.prisma,
      supabase: ctx.supabase
    }
  });
});
