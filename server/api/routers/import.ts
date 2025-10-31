import Papa from 'papaparse';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

const csvRowSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  unit: z.enum(['per_1k', 'job', 'enclose']),
  fromQty: z.coerce.number().int(),
  toQty: z.coerce.number().int(),
  pricePerThousand: z.coerce.number(),
  makeReadyFixed: z.coerce.number()
});

const parseCsv = (csv: string) => {
  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors.map((error) => error.message).join('; '));
  }

  return parsed.data.map((row) => csvRowSchema.parse(row));
};

export const importRouter = createTRPCRouter({
  preview: protectedProcedure
    .input(z.object({ csv: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const rows = parseCsv(input.csv);

      const summary = Object.values(
        rows.reduce<Record<string, { code: string; name: string; unit: string; bands: number }>>(
          (acc, row) => {
            if (!acc[row.code]) {
              acc[row.code] = { code: row.code, name: row.name, unit: row.unit, bands: 0 };
            }
            acc[row.code].bands += 1;
            return acc;
          },
          {}
        )
      );

      return {
        rows,
        summary
      };
    }),
  execute: protectedProcedure
    .input(
      z.object({
        csv: z.string().min(1),
        fileName: z.string().default(() => `rate-card-${Date.now()}.csv`)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = parseCsv(input.csv);

      const uploadsBucket = ctx.supabase.storage.from('imports');
      await uploadsBucket.upload(`/${input.fileName}`, Buffer.from(input.csv, 'utf-8'), {
        contentType: 'text/csv',
        upsert: true
      });

      const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => {
        acc[row.code] = acc[row.code] ? [...acc[row.code], row] : [row];
        return acc;
      }, {});

      await ctx.prisma.$transaction(async (tx) => {
        for (const [code, items] of Object.entries(grouped)) {
          const { name, unit } = items[0];

          const rateCard = await tx.rateCard.upsert({
            where: { code },
            update: { name, unit },
            create: {
              code,
              name,
              unit
            }
          });

          await tx.band.deleteMany({ where: { rateCardId: rateCard.id } });

          for (const band of items) {
            await tx.band.create({
              data: {
                rateCardId: rateCard.id,
                fromQty: band.fromQty,
                toQty: band.toQty,
                pricePerThousand: new Prisma.Decimal(band.pricePerThousand),
                makeReadyFixed: new Prisma.Decimal(band.makeReadyFixed)
              }
            });
          }
        }
      });

      return {
        imported: Object.keys(grouped).length
      };
    })
});
