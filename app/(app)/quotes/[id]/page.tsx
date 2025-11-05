import Decimal from 'decimal.js';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/pricing';
import { QuoteView } from '@/components/quotes/quote-view';
import { getAuthenticatedUser } from '@/lib/auth';

export default async function QuoteDetailPage({ params }: { params?: Promise<{ id: string }> }) {
  if (!params) throw new Error('No params provided');
  // SECURITY: Require authentication
  const user = await getAuthenticatedUser();
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { createdAt: 'asc' } },
      history: { orderBy: { createdAt: 'desc' } },
      user: true
    }
  });

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

  const serialisedQuote = {
    id: quote.id,
    clientName: quote.clientName,
    projectName: quote.projectName,
    reference: quote.reference,
    quantity: quote.quantity,
    envelopeType: quote.envelopeType,
    insertsCount: quote.insertsCount,
    pdfUrl: quote.pdfUrl,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    lines: quote.lines.map((line) => ({
      id: line.id,
      description: line.description,
      unitsInThousands: Number(line.unitsInThousands),
      unitPricePerThousand: Number(line.unitPricePerThousand),
      makeReadyFixed: Number(line.makeReadyFixed),
      lineTotalExVat: Number(line.lineTotalExVat)
    })),
    history: quote.history.map((entry) => ({
      id: entry.id,
      action: entry.action,
      payload: (entry.payload as Record<string, unknown>) || {},
      createdAt: entry.createdAt.toISOString()
    })),
    totals: {
      subtotal: totals.subtotal.toNumber(),
      total: totals.total.toNumber()
    }
  };

  return <QuoteView quote={serialisedQuote} />;
}
