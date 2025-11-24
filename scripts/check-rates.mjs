#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRates() {
  const count = await prisma.rateCard.count();
  const recent = await prisma.rateCard.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { bands: true }
  });

  console.log(`Total rate cards in database: ${count}\n`);
  console.log('Recent imports:');
  recent.forEach(rc => {
    console.log(`- ${rc.name}`);
    console.log(`  Code: ${rc.code}`);
    console.log(`  Unit: ${rc.unit}`);
    console.log(`  Price: £${rc.bands[0]?.pricePerThousand || 0}/1000 | Setup: £${rc.bands[0]?.makeReadyFixed || 0}`);
    console.log();
  });

  await prisma.$disconnect();
}

checkRates().catch(console.error);
