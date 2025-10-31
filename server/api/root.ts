import { createTRPCRouter } from '@/server/api/trpc';
import { rateCardsRouter } from '@/server/api/routers/rate-cards';
import { quotesRouter } from '@/server/api/routers/quotes';
import { importRouter } from '@/server/api/routers/import';

export const appRouter = createTRPCRouter({
  rateCards: rateCardsRouter,
  quotes: quotesRouter,
  imports: importRouter
});

export type AppRouter = typeof appRouter;
