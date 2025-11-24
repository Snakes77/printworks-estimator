#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearRateCards() {
  try {
    console.log('Starting to clear all rate cards...');
    console.log('⚠️  Warning: This will also delete all quote lines that reference rate cards.\n');

    // First, check if there are any quote lines
    const quoteLineCount = await prisma.quoteLine.count();
    console.log(`Found ${quoteLineCount} quote lines in the database.`);

    if (quoteLineCount > 0) {
      console.log('Deleting quote lines that reference rate cards...');
      const deletedQuoteLines = await prisma.quoteLine.deleteMany({
        where: {
          rateCardId: { not: 'custom' }
        }
      });
      console.log(`✓ Deleted ${deletedQuoteLines.count} quote lines (kept custom lines)`);
    }

    // Delete all rate card bands (due to foreign key constraints)
    const deletedBands = await prisma.band.deleteMany({});
    console.log(`✓ Deleted ${deletedBands.count} rate card bands`);

    // Finally, delete all rate cards
    const deletedCards = await prisma.rateCard.deleteMany({});
    console.log(`✓ Deleted ${deletedCards.count} rate cards`);

    console.log('\n✅ All rate cards have been cleared successfully!');
    console.log('You can now import your updated rate cards.');
  } catch (error) {
    console.error('❌ Error clearing rate cards:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearRateCards();
