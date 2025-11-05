import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

const bandSchema = z.object({
  id: z.string().optional(),
  fromQty: z.number().int().min(1).max(10_000_000),
  toQty: z.number().int().min(1).max(10_000_000),
  pricePerThousand: z.number().nonnegative().max(999_999.99),
  makeReadyFixed: z.number().nonnegative().max(999_999.99)
});

const rateCardSchema = z.object({
  code: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(200),
  unit: z.enum(['per_1k', 'job', 'enclose']),
  notes: z.string().trim().max(500).optional(),
  bands: z.array(bandSchema).min(1).max(50)
});

export const rateCardsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.rateCard.findMany({
      include: {
        bands: {
          orderBy: { fromQty: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
  }),
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.prisma.rateCard.findUnique({
      where: { id: input.id },
      include: {
        bands: {
          orderBy: { fromQty: 'asc' }
        }
      }
    });
  }),
  create: protectedProcedure.input(rateCardSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.rateCard.create({
      data: {
        code: input.code,
        name: input.name,
        unit: input.unit,
        notes: input.notes,
        bands: {
          create: input.bands.map((band) => ({
            fromQty: band.fromQty,
            toQty: band.toQty,
            pricePerThousand: band.pricePerThousand,
            makeReadyFixed: band.makeReadyFixed
          }))
        }
      },
      include: { bands: true }
    });
  }),
  update: protectedProcedure
    .input(rateCardSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, bands, ...rest } = input;

      return ctx.prisma.$transaction(async (tx) => {
        await tx.rateCard.update({
          where: { id },
          data: rest
        });

        const existingBands = await tx.band.findMany({ where: { rateCardId: id } });
        const keepIds = bands.filter((band) => band.id).map((band) => band.id!) as string[];
        const toDelete = existingBands.filter((band) => !keepIds.includes(band.id));

        if (toDelete.length) {
          await tx.band.deleteMany({
            where: {
              id: { in: toDelete.map((band) => band.id) }
            }
          });
        }

        for (const band of bands) {
          if (band.id) {
            await tx.band.update({
              where: { id: band.id },
              data: {
                fromQty: band.fromQty,
                toQty: band.toQty,
                pricePerThousand: band.pricePerThousand,
                makeReadyFixed: band.makeReadyFixed
              }
            });
          } else {
            await tx.band.create({
              data: {
                rateCardId: id,
                fromQty: band.fromQty,
                toQty: band.toQty,
                pricePerThousand: band.pricePerThousand,
                makeReadyFixed: band.makeReadyFixed
              }
            });
          }
        }

        return tx.rateCard.findUnique({
          where: { id },
          include: { bands: { orderBy: { fromQty: 'asc' } } }
        });
      });
    }),
  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.rateCard.delete({ where: { id: input.id } });
    return { success: true };
  })
});
