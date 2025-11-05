import { prisma } from '@/lib/prisma';
import { QuoteBuilder } from '@/components/quotes/quote-builder';
import { getAuthenticatedUser } from '@/lib/auth';

export default async function NewQuotePage() {
  // SECURITY: Require authentication
  await getAuthenticatedUser();

  const rateCards = await prisma.rateCard.findMany({
    include: { bands: { orderBy: { fromQty: 'asc' } } },
    orderBy: { name: 'asc' }
  });

  const serialisedRateCards = rateCards.map((card) => ({
    id: card.id,
    code: card.code,
    name: card.name,
    unit: card.unit,
    notes: card.notes,
    bands: card.bands.map((band) => ({
      id: band.id,
      fromQty: band.fromQty,
      toQty: band.toQty,
      pricePerThousand: Number(band.pricePerThousand),
      makeReadyFixed: Number(band.makeReadyFixed)
    }))
  }));

  return <QuoteBuilder rateCards={serialisedRateCards} />;
}
