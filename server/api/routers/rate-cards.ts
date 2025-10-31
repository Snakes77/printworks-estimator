import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/api/trpc';

const bandSchema = z.object({
  id: z.string().optional(),
  fromQty: z.number().int().min(1),
  toQty: z.number().int().min(1),
  pricePerThousand: z.number().nonnegative(),
  makeReadyFixed: z.number().nonnegative()
});

const rateCardSchema = z.object({
  code: z.string().trim().min(2),
  name: z.string().trim().min(2),
  unit: z.enum(['per_1k', 'job', 'enclose']),
  notes: z.string().trim().max(500).optional(),
  bands: z.array(bandSchema).min(1)
});

export const rateCardsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.rateCard.findMany({
      include: {
        bands: {
          orderBy: { fromQty: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
  }),
  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
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
        const updatedCard = await tx.rateCard.update({
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
