#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillQuoteReferences() {
  console.log('Starting quote reference backfill...\n');

  // Get all quotes without baseReference
  const quotes = await prisma.quote.findMany({
    where: { baseReference: null },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${quotes.length} quotes to backfill\n`);

  let updated = 0;

  for (const quote of quotes) {
    // Extract base reference from existing reference
    // Format: Q00001-0 or Q00001
    const match = quote.reference.match(/^(Q\d+)(?:-(\d+))?$/);

    if (match) {
      const baseReference = match[1]; // e.g., "Q00001"
      const revisionNumber = match[2] ? parseInt(match[2]) : 0; // e.g., 0

      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          baseReference,
          revisionNumber
        }
      });

      console.log(`✓ ${quote.reference} → base: ${baseReference}, revision: ${revisionNumber}`);
      updated++;
    } else {
      // Non-standard format - use existing reference as base
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          baseReference: quote.reference,
          revisionNumber: 0
        }
      });

      console.log(`⚠ ${quote.reference} (non-standard) → base: ${quote.reference}, revision: 0`);
      updated++;
    }
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Updated: ${updated} quotes`);

  await prisma.$disconnect();
}

backfillQuoteReferences().catch(console.error);
