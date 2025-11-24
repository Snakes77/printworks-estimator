import { prisma } from './prisma';

/**
 * Generates the next quote number in sequence (Q00001, Q00002, etc.)
 * Returns the base reference (e.g., "Q00001") and the computed reference (e.g., "Q00001-0")
 */
export async function getNextQuoteNumber(): Promise<{ baseReference: string; reference: string }> {
  // Get or create the counter
  const counter = await prisma.quoteCounter.upsert({
    where: { id: 'singleton' },
    update: {
      lastNumber: { increment: 1 }
    },
    create: {
      id: 'singleton',
      lastNumber: 1
    }
  });

  // Format as Q00001, Q00002, etc.
  const baseReference = `Q${String(counter.lastNumber).padStart(5, '0')}`;
  const reference = `${baseReference}-0`; // First revision is -0

  return { baseReference, reference };
}

/**
 * Gets the next revision number for an existing quote
 */
export async function getNextRevisionNumber(baseReference: string): Promise<number> {
  const existingQuotes = await prisma.quote.findMany({
    where: { baseReference },
    select: { revisionNumber: true },
    orderBy: { revisionNumber: 'desc' },
    take: 1
  });

  if (existingQuotes.length === 0) {
    return 0;
  }

  return existingQuotes[0]!.revisionNumber + 1;
}

