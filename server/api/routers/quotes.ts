import { Prisma } from '@prisma/client';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { calculateLine, calculateQuoteLines, calculateTotals } from '@/lib/pricing';
import { ensurePrismaUser } from '@/lib/app-user';
import { generateQuotePdfBuffer } from '@/server/pdf/generator';

const serialiseLine = (line: {
  id: string;
  quoteId: string;
  rateCardId: string;
  description: string;
  unitPricePerThousand: Prisma.Decimal;
  makeReadyFixed: Prisma.Decimal;
  unitsInThousands: Prisma.Decimal;
  lineTotalExVat: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...line,
  unitPricePerThousand: Number(line.unitPricePerThousand),
  makeReadyFixed: Number(line.makeReadyFixed),
  unitsInThousands: Number(line.unitsInThousands),
  lineTotalExVat: Number(line.lineTotalExVat)
});

const serialiseTotals = (totals: ReturnType<typeof calculateTotals>) => ({
  subtotal: totals.subtotal.toNumber(),
  vat: totals.vat.toNumber(),
  total: totals.total.toNumber()
});

const lineSelectionSchema = z.object({
  rateCardId: z.string(),
  description: z.string().optional()
});

const quotePayloadSchema = z.object({
  clientName: z.string().trim().min(2),
  projectName: z.string().trim().min(1),
  reference: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  envelopeType: z.string().trim().min(1),
  insertsCount: z.number().int().min(0),
  vatRate: z.number().min(0),
  lines: z.array(lineSelectionSchema).min(1)
});

export const quotesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional()
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const user = await ensurePrismaUser(ctx.user);
      const where = {
        userId: user.id,
        ...(input?.search
          ? {
              OR: [
                { clientName: { contains: input.search, mode: 'insensitive' } },
                { reference: { contains: input.search, mode: 'insensitive' } }
              ]
            }
          : {})
      } satisfies Prisma.QuoteWhereInput;

      const quotes = await ctx.prisma.quote.findMany({
        where,
        include: {
          lines: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      return quotes.map((quote) => {
        const totals = calculateTotals(
          quote.lines.map((line) => ({
            rateCardId: line.rateCardId,
            description: line.description,
            unitPricePerThousand: new Decimal(line.unitPricePerThousand.toString()),
            makeReadyFixed: new Decimal(line.makeReadyFixed.toString()),
            unitsInThousands: new Decimal(line.unitsInThousands.toString()),
            lineTotalExVat: new Decimal(line.lineTotalExVat.toString())
          })),
          Number(quote.vatRate)
        );

        return {
          id: quote.id,
          clientName: quote.clientName,
          projectName: quote.projectName,
          reference: quote.reference,
          quantity: quote.quantity,
          envelopeType: quote.envelopeType,
          insertsCount: quote.insertsCount,
          vatRate: Number(quote.vatRate),
          pdfUrl: quote.pdfUrl,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
          totals: serialiseTotals(totals)
        };
      });
    }),
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const quote = await ctx.prisma.quote.findUnique({
      where: { id: input.id },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' }
        },
        user: true,
        history: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!quote) {
      throw new Error('Quote not found');
    }

    const totals = calculateTotals(
      quote.lines.map((line) => ({
        rateCardId: line.rateCardId,
        description: line.description,
        unitPricePerThousand: new Decimal(line.unitPricePerThousand.toString()),
        makeReadyFixed: new Decimal(line.makeReadyFixed.toString()),
        unitsInThousands: new Decimal(line.unitsInThousands.toString()),
        lineTotalExVat: new Decimal(line.lineTotalExVat.toString())
      })),
      Number(quote.vatRate)
    );

    return {
      id: quote.id,
      clientName: quote.clientName,
      projectName: quote.projectName,
      reference: quote.reference,
      quantity: quote.quantity,
      envelopeType: quote.envelopeType,
      insertsCount: quote.insertsCount,
      vatRate: Number(quote.vatRate),
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      pdfUrl: quote.pdfUrl,
      user: quote.user,
      history: quote.history,
      lines: quote.lines.map(serialiseLine),
      totals: serialiseTotals(totals)
    };
  }),
  preview: protectedProcedure.input(quotePayloadSchema).mutation(async ({ ctx, input }) => {
    const rateCards = await ctx.prisma.rateCard.findMany({
      where: { id: { in: input.lines.map((line) => line.rateCardId) } },
      include: { bands: { orderBy: { fromQty: 'asc' } } }
    });

    const orderedCards = input.lines.map((line) => {
      const card = rateCards.find((rc) => rc.id === line.rateCardId);
      if (!card) {
        throw new Error(`Rate card ${line.rateCardId} not found`);
      }
      return card;
    });

    const lines = calculateQuoteLines(input.quantity, input.insertsCount, orderedCards);
    const totals = calculateTotals(lines, input.vatRate);

    return {
      lines: lines.map((line) => ({
        rateCardId: line.rateCardId,
        description: line.description,
        unitPricePerThousand: line.unitPricePerThousand.toNumber(),
        makeReadyFixed: line.makeReadyFixed.toNumber(),
        unitsInThousands: line.unitsInThousands.toNumber(),
        lineTotalExVat: line.lineTotalExVat.toNumber()
      })),
      totals: serialiseTotals(totals)
    };
  }),
  create: protectedProcedure.input(quotePayloadSchema).mutation(async ({ ctx, input }) => {
    const user = await ensurePrismaUser(ctx.user);

    const rateCards = await ctx.prisma.rateCard.findMany({
      where: { id: { in: input.lines.map((line) => line.rateCardId) } },
      include: { bands: { orderBy: { fromQty: 'asc' } } }
    });

    const orderedCards = input.lines.map((line) => {
      const card = rateCards.find((rc) => rc.id === line.rateCardId);
      if (!card) {
        throw new Error(`Rate card ${line.rateCardId} not found`);
      }
      return card;
    });

    const lineCalculations = orderedCards.map((card) => {
      const band = card.bands.find(
        (b) => input.quantity >= b.fromQty && input.quantity <= b.toQty
      );
      if (!band) {
        throw new Error(`No band for ${card.name} at quantity ${input.quantity}`);
      }
      return calculateLine(card, band, input.quantity, input.insertsCount);
    });

    const totals = calculateTotals(lineCalculations, input.vatRate);

    const quote = await ctx.prisma.quote.create({
      data: {
        userId: user.id,
        clientName: input.clientName,
        projectName: input.projectName,
        reference: input.reference,
        quantity: input.quantity,
        envelopeType: input.envelopeType,
        insertsCount: input.insertsCount,
        vatRate: new Prisma.Decimal(input.vatRate),
        lines: {
          create: lineCalculations.map((line) => ({
            rateCardId: line.rateCardId,
            description: line.description,
            unitPricePerThousand: new Prisma.Decimal(line.unitPricePerThousand.toString()),
            makeReadyFixed: new Prisma.Decimal(line.makeReadyFixed.toString()),
            unitsInThousands: new Prisma.Decimal(line.unitsInThousands.toString()),
            lineTotalExVat: new Prisma.Decimal(line.lineTotalExVat.toString())
          }))
        },
        history: {
          create: {
            action: 'CREATED',
            payload: {
              lines: lineCalculations.map((line) => ({
                rateCardId: line.rateCardId,
                lineTotalExVat: line.lineTotalExVat.toString()
              })),
              totals: {
                subtotal: totals.subtotal.toString(),
                vat: totals.vat.toString(),
                total: totals.total.toString()
              }
            }
          }
        }
      },
      include: { lines: true }
    });

    return {
      ...quote,
      vatRate: Number(quote.vatRate),
      lines: quote.lines.map(serialiseLine)
    };
  }),
  update: protectedProcedure
    .input(quotePayloadSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.quote.findUnique({
        where: { id: input.id },
        include: { lines: true }
      });

      if (!existing) {
        throw new Error('Quote not found');
      }

      await ctx.prisma.quoteLine.deleteMany({ where: { quoteId: existing.id } });

      const rateCards = await ctx.prisma.rateCard.findMany({
        where: { id: { in: input.lines.map((line) => line.rateCardId) } },
        include: { bands: { orderBy: { fromQty: 'asc' } } }
      });

      const orderedCards = input.lines.map((line) => {
        const card = rateCards.find((rc) => rc.id === line.rateCardId);
        if (!card) {
          throw new Error(`Rate card ${line.rateCardId} not found`);
        }
        return card;
      });

      const lineCalculations = orderedCards.map((card) => {
        const band = card.bands.find(
          (b) => input.quantity >= b.fromQty && input.quantity <= b.toQty
        );
        if (!band) {
          throw new Error(`No band for ${card.name} at quantity ${input.quantity}`);
      }
        return calculateLine(card, band, input.quantity, input.insertsCount);
      });

      const totals = calculateTotals(lineCalculations, input.vatRate);

      const updated = await ctx.prisma.quote.update({
        where: { id: input.id },
        data: {
          clientName: input.clientName,
          projectName: input.projectName,
          reference: input.reference,
          quantity: input.quantity,
          envelopeType: input.envelopeType,
          insertsCount: input.insertsCount,
          vatRate: new Prisma.Decimal(input.vatRate),
          lines: {
            create: lineCalculations.map((line) => ({
              rateCardId: line.rateCardId,
              description: line.description,
              unitPricePerThousand: new Prisma.Decimal(line.unitPricePerThousand.toString()),
              makeReadyFixed: new Prisma.Decimal(line.makeReadyFixed.toString()),
              unitsInThousands: new Prisma.Decimal(line.unitsInThousands.toString()),
              lineTotalExVat: new Prisma.Decimal(line.lineTotalExVat.toString())
            }))
          },
        history: {
          create: {
            action: 'UPDATED',
            payload: {
              lines: lineCalculations.map((line) => ({
                  rateCardId: line.rateCardId,
                  lineTotalExVat: line.lineTotalExVat.toString()
                })),
                totals: {
                  subtotal: totals.subtotal.toString(),
                  vat: totals.vat.toString(),
                  total: totals.total.toString()
                }
              }
            }
          }
        },
        include: { lines: true }
      });

      return {
        ...updated,
        vatRate: Number(updated.vatRate),
        lines: updated.lines.map(serialiseLine)
      };
    }),
  generatePdf: protectedProcedure
    .input(z.object({ quoteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { pdf, totals } = await generateQuotePdfBuffer(input.quoteId);

      const storage = ctx.supabase.storage.from('quotes');
      const filePath = `${input.quoteId}.pdf`;
      const uploadResult = await storage.upload(filePath, pdf, {
        contentType: 'application/pdf',
        upsert: true
      });

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const {
        data: { publicUrl }
      } = storage.getPublicUrl(filePath);

      await ctx.prisma.quote.update({
        where: { id: input.quoteId },
        data: {
          pdfUrl: publicUrl,
          history: {
            create: {
              action: 'PDF_GENERATED',
              payload: {
                pdfUrl: publicUrl,
                totals
              }
            }
          }
        }
      });

      return { pdfUrl: publicUrl, totals };
    })
});
