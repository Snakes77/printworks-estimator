import { PrismaClient, QuoteCategory } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Backfills categories for existing quote lines based on their rate card's category.
 * If a rate card doesn't have a category, defaults to PRINT.
 */
async function main() {
  console.log('Backfilling categories for existing quote lines...\n');

  // Get all quote lines without categories (shouldn't happen with new schema, but for safety)
  const quoteLines = await prisma.quoteLine.findMany({
    include: {
      rateCard: {
        select: { category: true }
      }
    }
  });

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const line of quoteLines) {
    // Get category from rate card, default to PRINT
    const category = line.rateCard?.category || 'PRINT';

    try {
      await prisma.quoteLine.update({
        where: { id: line.id },
        data: { category }
      });
      updated++;
    } catch (error) {
      console.error(`✗ Failed to update line ${line.id}:`, error);
      errors++;
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);

  // Also backfill baseReference and revisionNumber for existing quotes
  console.log('\nBackfilling quote numbering for existing quotes...\n');

  const quotes = await prisma.quote.findMany({
    select: { id: true, reference: true, baseReference: true, revisionNumber: true }
  });

  let quotesUpdated = 0;
  let quotesSkipped = 0;

  for (const quote of quotes) {
    // If baseReference is already set, skip
    if (quote.baseReference) {
      quotesSkipped++;
      continue;
    }

    // Try to extract base reference from existing reference
    const match = quote.reference.match(/^(Q\d{5})(?:-(\d+))?$/);
    
    if (match) {
      const baseReference = match[1]!;
      const revisionNumber = match[2] ? parseInt(match[2]!, 10) : 0;

      try {
        await prisma.quote.update({
          where: { id: quote.id },
          data: {
            baseReference,
            revisionNumber
          }
        });
        quotesUpdated++;
        console.log(`✓ ${quote.reference} → ${baseReference}-${revisionNumber}`);
      } catch (error) {
        console.error(`✗ Failed to update quote ${quote.id}:`, error);
        errors++;
      }
    } else {
      // Generate a new base reference for quotes that don't match the pattern
      // This is a fallback - ideally all quotes should have proper numbering
      const baseReference = `Q${String(quotesUpdated + 1).padStart(5, '0')}`;
      try {
        await prisma.quote.update({
          where: { id: quote.id },
          data: {
            baseReference,
            revisionNumber: 0
          }
        });
        quotesUpdated++;
        console.log(`✓ ${quote.reference} → ${baseReference}-0 (generated)`);
      } catch (error) {
        console.error(`✗ Failed to update quote ${quote.id}:`, error);
        errors++;
      }
    }
  }

  console.log(`\n✅ Quote numbering done!`);
  console.log(`   Updated: ${quotesUpdated}`);
  console.log(`   Skipped: ${quotesSkipped}`);
  console.log(`   Errors: ${errors}`);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

