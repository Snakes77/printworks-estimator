import Decimal from 'decimal.js';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/pricing';
import { QuoteBuilder } from '@/components/quotes/quote-builder';
import { getAuthenticatedUser } from '@/lib/auth';

export default async function EditQuotePage({ params }: { params?: Promise<{ id: string }> }) {
  if (!params) throw new Error('No params provided');
  // SECURITY: Require authentication
  const user = await getAuthenticatedUser();
  const { id } = await params;

  const [quote, rateCards] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        user: true
      }
    }),
    prisma.rateCard.findMany({ include: { bands: { orderBy: { fromQty: 'asc' } } }, orderBy: { name: 'asc' } })
  ]);

  if (!quote) {
    notFound();
  }

  // SECURITY: Verify ownership
  if (quote.userId !== user.id) {
    notFound(); // Don't reveal quote exists
  }

  const totals = calculateTotals(
    quote.lines.map((line) => ({
      rateCardId: line.rateCardId,
      description: line.description,
      unitPricePerThousand: new Decimal(line.unitPricePerThousand.toString()),
      makeReadyFixed: new Decimal(line.makeReadyFixed.toString()),
      unitsInThousands: new Decimal(line.unitsInThousands.toString()),
      lineTotalExVat: new Decimal(line.lineTotalExVat.toString())
    }))
  );

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

  const existingQuote = {
    id: quote.id,
    clientName: quote.clientName,
    projectName: quote.projectName,
    reference: quote.reference,
    quantity: quote.quantity,
    envelopeType: quote.envelopeType,
    insertsCount: quote.insertsCount,
    vatRate: Number(quote.vatRate),
    lines: quote.lines.map((line) => ({
      rateCardId: line.rateCardId,
      description: line.description,
      unitPricePerThousand: Number(line.unitPricePerThousand),
      makeReadyFixed: Number(line.makeReadyFixed),
      unitsInThousands: Number(line.unitsInThousands),
      lineTotalExVat: Number(line.lineTotalExVat)
    })),
    totals: {
      subtotal: totals.subtotal.toNumber(),
      total: totals.total.toNumber()
    }
  };

  return <QuoteBuilder rateCards={serialisedRateCards} existingQuote={existingQuote} />;
}
