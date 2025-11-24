#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple categorization based on operation names
const categories = {
  // Data Processing
  'Receive 1 file, standard job set up and proof and covert to print image  ': 'DATA_PROCESSING',
  'Receive and proof additional data files. Price includes production cell changes  ': 'DATA_PROCESSING',

  // Personalisation
  'Machine set up (inkjet) ': 'PERSONALISATION',
  'Machine Set up (laser)': 'PERSONALISATION',
  'Machine Set up ': 'PERSONALISATION',
  'Machine Set up (standard) ': 'PERSONALISATION',
  'Additional machine set up for match pack ': 'PERSONALISATION',
  'Additonal machine set up for stream/batch/side feed': 'PERSONALISATION',
  'Additional machine set up for heavy pack ': 'PERSONALISATION',
  'Additional machine set up for 5 plus items ': 'PERSONALISATION',
  'Machine Set up (Polyline)': 'PERSONALISATION',
  'Laser A4 simplex ': 'PERSONALISATION',
  'Laser A3 simplex ': 'PERSONALISATION',
  'Laser A4 duplex ': 'PERSONALISATION',
  'Laser A3 duplex ': 'PERSONALISATION',
  'Laser extended A4 simplex ': 'PERSONALISATION',
  'Laser extended A4 duplex ': 'PERSONALISATION',
  'Inkjet A5/DL/C6 Mailer': 'PERSONALISATION',
  'Inkjet A5/DL/C6 Brochure (under 100g) ': 'PERSONALISATION',
  'Inkjet A5/DL/C6 Brochure (100g-250g) ': 'PERSONALISATION',

  // Finishing
  'Fold A4 to A5/DL': 'FINISHING',
  'Fold A3 to A5/DL': 'FINISHING',
  'Roll fold extended A4 to A5/DL': 'FINISHING',
  'Add to any finishing price for gate fold or bolt edge trim ': 'FINISHING',
  'Polywrap 1-3 A5 items under 100g': 'FINISHING',
  'Polywrap 1-3 A5 items 101g-250g': 'FINISHING',
  'Polywrap 1-3 A4/large letter items under 100g': 'FINISHING',
  'Polywrap 1-3 A4/large letter items 101g-250g': 'FINISHING',
  'Polywrap 1-3 A4/large letter items 251g-500g': 'FINISHING',
  'Polywrap 1-3 A4/large letter items over 500g': 'FINISHING',

  // Enclosing
  'Enclose 1-3 standard items into C5/C6/DL': 'ENCLOSING',
  'Enclose 4-5 standard items into C5/C6/DL': 'ENCLOSING',
  'Enclose 6-8 items into C5/C6/DL': 'ENCLOSING',
  'Additional charge if C4 or large letter Envelope ': 'ENCLOSING',
  'Additional charge for machine matching (1 item)': 'ENCLOSING',
  'Additonal charge for machine matching (2 items) ': 'ENCLOSING',
  'Additonal charge for machine matching (3 items) ': 'ENCLOSING',
  'Additonal charge for machine matching (4 items) ': 'ENCLOSING'
};

async function categorizeRateCards() {
  console.log('Starting rate card categorization...\n');

  let updated = 0;
  let skipped = 0;

  for (const [name, category] of Object.entries(categories)) {
    try {
      const result = await prisma.rateCard.updateMany({
        where: { name },
        data: { category }
      });

      if (result.count > 0) {
        console.log(`✓ ${name} → ${category}`);
        updated++;
      } else {
        console.log(`⚠ Not found: ${name}`);
        skipped++;
      }
    } catch (error) {
      console.error(`✗ Error updating ${name}:`, error.message);
      skipped++;
    }
  }

  console.log(`\n✅ Categorization complete!`);
  console.log(`   Updated: ${updated} rate cards`);
  console.log(`   Skipped: ${skipped} rate cards`);

  await prisma.$disconnect();
}

categorizeRateCards().catch(console.error);
