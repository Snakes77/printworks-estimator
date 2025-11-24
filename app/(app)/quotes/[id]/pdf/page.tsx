import Decimal from 'decimal.js';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { QuotePdf } from '@/components/quotes/quote-pdf';
import { calculateTotals } from '@/lib/pricing';
import { getAuthenticatedUser } from '@/lib/auth';

export default async function QuotePdfPage({ params }: { params: Promise<{ id: string }> }) {
  // SECURITY: Require authentication
  const user = await getAuthenticatedUser();
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { 
      lines: { orderBy: { createdAt: 'asc' } },
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
    })),
    Number(quote.vatRate)
  );

  return (
    <QuotePdf
      quote={{
        id: quote.id,
        clientName: quote.clientName,
        projectName: quote.projectName,
        reference: quote.reference,
        quantity: quote.quantity,
        createdAt: quote.createdAt,
        lines: quote.lines.map((line) => ({
          description: line.description,
          unitsInThousands: Number(line.unitsInThousands),
          unitPricePerThousand: Number(line.unitPricePerThousand),
          makeReadyFixed: Number(line.makeReadyFixed),
          lineTotalExVat: Number(line.lineTotalExVat)
        }))
      }}
      totals={{
        subtotal: totals.subtotal.toNumber(),
        vat: totals.vat.toNumber(),
        total: totals.total.toNumber()
      }}
    />
  );
}
