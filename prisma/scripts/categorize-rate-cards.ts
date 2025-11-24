import { PrismaClient, QuoteCategory } from '@prisma/client';

const prisma = new PrismaClient();

// Map rate card codes to categories based on naming patterns
// Update this mapping based on your actual 38 rate cards
const RATE_CARD_CATEGORIES: Record<string, QuoteCategory> = {
  // Envelopes
  'ENV-C5': 'ENVELOPES',
  'ENV-C4': 'ENVELOPES',
  'ENV-DL': 'ENVELOPES',
  
  // Data Processing
  'DATA-IN': 'DATA_PROCESSING',
  'DATA-PROOF': 'DATA_PROCESSING',
  'DATA-CLEAN': 'DATA_PROCESSING',
  'DATA-VALIDATE': 'DATA_PROCESSING',
  
  // Personalisation
  'A4-SIMPLEX': 'PERSONALISATION',
  'A4-DUPLEX': 'PERSONALISATION',
  'A5-SIMPLEX': 'PERSONALISATION',
  'A5-DUPLEX': 'PERSONALISATION',
  
  // Finishing
  'FOLD-A4-A5': 'FINISHING',
  'FOLD-A3-A5': 'FINISHING',
  'FOLD-A4-A6': 'FINISHING',
  'CUT': 'FINISHING',
  'TRIMMING': 'FINISHING',
  
  // Enclosing
  'ENCLOSE': 'ENCLOSING',
  
  // Postage
  'POST-C5-STANDARD': 'POSTAGE',
  'POST-C5-FIRST': 'POSTAGE',
  'POST-C4-STANDARD': 'POSTAGE',
  'POST-C4-FIRST': 'POSTAGE',
  'POST-DL-STANDARD': 'POSTAGE',
  'POST-DL-FIRST': 'POSTAGE',
  
  // Print (default for any print-related rate cards)
  'PRINT-A4': 'PRINT',
  'PRINT-A5': 'PRINT',
};

async function main() {
  console.log('Categorizing rate cards...\n');

  // Get all rate cards
  const rateCards = await prisma.rateCard.findMany({
    select: { id: true, code: true, name: true, category: true }
  });

  let categorized = 0;
  let skipped = 0;
  let errors = 0;

  for (const rateCard of rateCards) {
    const category = RATE_CARD_CATEGORIES[rateCard.code];
    
    if (category) {
      try {
        await prisma.rateCard.update({
          where: { id: rateCard.id },
          data: { category }
        });
        console.log(`✓ ${rateCard.code} → ${category}`);
        categorized++;
      } catch (error) {
        console.error(`✗ Failed to update ${rateCard.code}:`, error);
        errors++;
      }
    } else {
      console.log(`⚠ ${rateCard.code} (${rateCard.name}) - No category mapping found`);
      skipped++;
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Categorized: ${categorized}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  if (skipped > 0) {
    console.log(`\n⚠️  Please add mappings for skipped rate cards in categorize-rate-cards.ts`);
  }
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

