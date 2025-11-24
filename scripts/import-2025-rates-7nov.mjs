#!/usr/bin/env node
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function importRates() {
  const workbook = XLSX.readFile('./New Estimate rates list - 2025 - 7th Nov.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`Found ${rows.length} rows in Excel file`);
  console.log('First few rows:', rows.slice(0, 5));

  // Skip header row (index 0) and empty rows
  const dataRows = rows.slice(1).filter(row => row && row[0]);

  let imported = 0;
  let skipped = 0;

  for (const row of dataRows) {
    const [process, setupCharge, unit, category, pricePerThousand] = row;

    // Skip rows with invalid data
    if (!process || process === 'Process') continue;

    // Parse prices
    const makeReadyFixed = typeof setupCharge === 'number' ? setupCharge : 0;
    const price = typeof pricePerThousand === 'number' ? pricePerThousand : 0;

    // Skip only if NO pricing at all (both setup and per-1000 are zero or missing)
    if (makeReadyFixed === 0 && price === 0) {
      console.log(`Skipping "${process}" - no pricing data`);
      skipped++;
      continue;
    }

    // Generate a code from the process name
    const code = process
      .substring(0, 50)
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .toUpperCase();

    try {
      // Check if rate card already exists
      const existing = await prisma.rateCard.findUnique({
        where: { code },
      });

      if (existing) {
        console.log(`Updating: ${process}`);
        await prisma.rateCard.update({
          where: { code },
          data: {
            name: process,
            unit: unit || 'per_1k',
            notes: category || '',
          },
        });

        // Delete existing bands and create new one
        await prisma.band.deleteMany({
          where: { rateCardId: existing.id },
        });

        await prisma.band.create({
          data: {
            rateCardId: existing.id,
            fromQty: 0,
            toQty: 999999,
            pricePerThousand: price,
            makeReadyFixed: makeReadyFixed,
          },
        });
      } else {
        console.log(`Creating: ${process}`);
        await prisma.rateCard.create({
          data: {
            code,
            name: process,
            unit: unit || 'per_1k',
            notes: category || '',
            bands: {
              create: {
                fromQty: 0,
                toQty: 999999,
                pricePerThousand: price,
                makeReadyFixed: makeReadyFixed,
              },
            },
          },
        });
      }

      imported++;
    } catch (error) {
      console.error(`Error importing "${process}":`, error.message);
      skipped++;
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Skipped: ${skipped}`);
}

importRates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
