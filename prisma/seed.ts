import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const rateCards: Prisma.RateCardCreateInput[] = [
  {
    code: 'DATA-IN',
    name: 'Data Ingestion',
    unit: 'per_1k',
    notes: 'Standard data preparation and validation.',
    bands: {
      create: [
        { fromQty: 1, toQty: 10000, pricePerThousand: new Prisma.Decimal(35), makeReadyFixed: new Prisma.Decimal(45) },
        { fromQty: 10001, toQty: 50000, pricePerThousand: new Prisma.Decimal(28), makeReadyFixed: new Prisma.Decimal(45) },
        { fromQty: 50001, toQty: 200000, pricePerThousand: new Prisma.Decimal(22), makeReadyFixed: new Prisma.Decimal(35) }
      ]
    }
  },
  {
    code: 'A4-SIMPLEX',
    name: 'Personalise A4 Simplex',
    unit: 'per_1k',
    notes: 'Digital print simplex.',
    bands: {
      create: [
        { fromQty: 1, toQty: 10000, pricePerThousand: new Prisma.Decimal(70), makeReadyFixed: new Prisma.Decimal(65) },
        { fromQty: 10001, toQty: 50000, pricePerThousand: new Prisma.Decimal(55), makeReadyFixed: new Prisma.Decimal(65) },
        { fromQty: 50001, toQty: 200000, pricePerThousand: new Prisma.Decimal(48), makeReadyFixed: new Prisma.Decimal(55) }
      ]
    }
  },
  {
    code: 'FOLD-A4-A5',
    name: 'Fold A4 to A5',
    unit: 'per_1k',
    bands: {
      create: [
        { fromQty: 1, toQty: 10000, pricePerThousand: new Prisma.Decimal(25), makeReadyFixed: new Prisma.Decimal(30) },
        { fromQty: 10001, toQty: 50000, pricePerThousand: new Prisma.Decimal(19), makeReadyFixed: new Prisma.Decimal(28) },
        { fromQty: 50001, toQty: 200000, pricePerThousand: new Prisma.Decimal(16), makeReadyFixed: new Prisma.Decimal(26) }
      ]
    }
  },
  {
    code: 'ENV-C5',
    name: 'Envelope Supply C5',
    unit: 'job',
    bands: {
      create: [
        { fromQty: 1, toQty: 999999, pricePerThousand: new Prisma.Decimal(0), makeReadyFixed: new Prisma.Decimal(135) }
      ]
    }
  },
  {
    code: 'ENCLOSE',
    name: 'Enclose Items',
    unit: 'enclose',
    notes: 'Insert-aware enclosing line.',
    bands: {
      create: [
        { fromQty: 1, toQty: 10000, pricePerThousand: new Prisma.Decimal(40), makeReadyFixed: new Prisma.Decimal(60) },
        { fromQty: 10001, toQty: 50000, pricePerThousand: new Prisma.Decimal(32), makeReadyFixed: new Prisma.Decimal(60) },
        { fromQty: 50001, toQty: 200000, pricePerThousand: new Prisma.Decimal(27), makeReadyFixed: new Prisma.Decimal(55) }
      ]
    }
  },
  {
    code: 'POST-C5-STANDARD',
    name: 'Postage C5 Standard',
    unit: 'per_1k',
    notes: 'Royal Mail standard class.',
    bands: {
      create: [
        { fromQty: 1, toQty: 10000, pricePerThousand: new Prisma.Decimal(295), makeReadyFixed: new Prisma.Decimal(0) },
        { fromQty: 10001, toQty: 50000, pricePerThousand: new Prisma.Decimal(285), makeReadyFixed: new Prisma.Decimal(0) },
        { fromQty: 50001, toQty: 200000, pricePerThousand: new Prisma.Decimal(275), makeReadyFixed: new Prisma.Decimal(0) }
      ]
    }
  }
];

async function main() {
  await prisma.quoteHistory.deleteMany();
  await prisma.quoteLine.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.band.deleteMany();
  await prisma.rateCard.deleteMany();
  await prisma.user.deleteMany();

  await prisma.rateCard.createMany({
    data: rateCards.map(({ code, name, unit, notes }) => ({ code, name, unit, notes }))
  });

  for (const rc of rateCards) {
    const created = await prisma.rateCard.findUnique({ where: { code: rc.code } });
    if (!created) continue;
    const bandsArray = Array.isArray(rc.bands?.create) ? rc.bands.create : [];
    for (const band of bandsArray) {
      await prisma.band.create({
        data: {
          rateCardId: created.id,
          fromQty: band.fromQty,
          toQty: band.toQty,
          pricePerThousand: band.pricePerThousand,
          makeReadyFixed: band.makeReadyFixed
        }
      });
    }
  }

  const demoUser = await prisma.user.create({
    data: {
      id: 'demo-user-id',
      email: 'dave@example.co.uk',
      name: 'Dave Estimator'
    }
  });

  console.log('Seed completed for user', demoUser.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
