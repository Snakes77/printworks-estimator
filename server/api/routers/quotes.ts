import { Prisma } from '@prisma/client';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { calculateLine, calculateQuoteLines, calculateTotals } from '@/lib/pricing';
import { ensurePrismaUser } from '@/lib/app-user';
import { verifyQuoteOwnership } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { sendQuoteEmail } from '@/lib/email';
import { generatePdfFromUrl, isPdfCoConfigured } from '@/lib/pdf/pdfco';

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
  total: totals.total.toNumber()
});

const lineSelectionSchema = z.object({
  rateCardId: z.string(),
  description: z.string().optional()
});

const quotePayloadSchema = z.object({
  clientName: z.string().trim().min(2).max(200),
  projectName: z.string().trim().min(1).max(200),
  reference: z.string().trim().min(1).max(100),
  quantity: z.number().int().positive().max(1_000_000),
  envelopeType: z.string().trim().min(1).max(50),
  insertsCount: z.number().int().min(0).max(100),
  lines: z.array(lineSelectionSchema).min(1).max(100)
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
      // SECURITY: Always scope queries to current user
      const where = {
        userId: user.id, // CRITICAL: User can only see their own quotes
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
          }))
        );

        return {
          id: quote.id,
          clientName: quote.clientName,
          projectName: quote.projectName,
          reference: quote.reference,
          quantity: quote.quantity,
          envelopeType: quote.envelopeType,
          insertsCount: quote.insertsCount,
          pdfUrl: quote.pdfUrl,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
          totals: serialiseTotals(totals)
        };
      });
    }),
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const user = await ensurePrismaUser(ctx.user);
    
    // SECURITY: Verify ownership before returning quote
    await verifyQuoteOwnership(input.id, user.id);

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
      }))
    );

    return {
      id: quote.id,
      clientName: quote.clientName,
      projectName: quote.projectName,
      reference: quote.reference,
      quantity: quote.quantity,
      envelopeType: quote.envelopeType,
      insertsCount: quote.insertsCount,
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
    const totals = calculateTotals(lines);

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
    
    // SECURITY: Rate limit quote creation
    await checkRateLimit(user.id, RATE_LIMITS.QUOTE_CREATE);

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

    const totals = calculateTotals(lineCalculations);

    const quote = await ctx.prisma.quote.create({
      data: {
        userId: user.id,
        clientName: input.clientName,
        projectName: input.projectName,
        reference: input.reference,
        quantity: input.quantity,
        envelopeType: input.envelopeType,
        insertsCount: input.insertsCount,
        vatRate: new Prisma.Decimal(0), // Quotes don't include VAT, set to 0 for backward compatibility
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
      lines: quote.lines.map(serialiseLine)
    };
  }),
  update: protectedProcedure
    .input(quotePayloadSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ensurePrismaUser(ctx.user);
      
      // SECURITY: Verify ownership before allowing update
      await verifyQuoteOwnership(input.id, user.id);

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

      const totals = calculateTotals(lineCalculations);

      const updated = await ctx.prisma.quote.update({
        where: { id: input.id },
        data: {
          clientName: input.clientName,
          projectName: input.projectName,
          reference: input.reference,
          quantity: input.quantity,
          envelopeType: input.envelopeType,
          insertsCount: input.insertsCount,
          vatRate: new Prisma.Decimal(0), // Quotes don't include VAT, set to 0 for backward compatibility
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
        lines: updated.lines.map(serialiseLine)
      };
    }),
  generatePdf: protectedProcedure
    .input(z.object({ quoteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await ensurePrismaUser(ctx.user);

        // SECURITY: Rate limit PDF generation
        await checkRateLimit(user.id, RATE_LIMITS.PDF_GENERATION);

        // SECURITY: Verify ownership before generating PDF URL
        await verifyQuoteOwnership(input.quoteId, user.id);

        // Return print URL - browser will handle PDF generation
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
        const printUrl = `${baseUrl}/quotes/${input.quoteId}/print`;

        console.log('[tRPC] generatePdf: Returning print URL for browser-based PDF');

        return {
          printUrl,
          pdfUrl: printUrl, // For compatibility
          totals: { subtotal: 0, total: 0 } // Placeholder
        };
      } catch (error) {
        console.error('[tRPC] generatePdf: Error occurred:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to generate PDF URL: ${errorMessage}`);
      }
    }),
  sendEmail: protectedProcedure
    .input(z.object({
      quoteId: z.string(),
      to: z.string().email('Invalid email address')
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await ensurePrismaUser(ctx.user);

        // SECURITY: Verify ownership before sending email
        await verifyQuoteOwnership(input.quoteId, user.id);

        // Get quote details
        const quote = await ctx.prisma.quote.findUnique({
          where: { id: input.quoteId },
          include: {
            lines: { orderBy: { createdAt: 'asc' } }
          }
        });

        if (!quote) {
          throw new Error('Quote not found');
        }

        // Generate PDF using PDF.co
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
        const printUrl = `${baseUrl}/quotes/${input.quoteId}/print`;

        let pdfBuffer: Buffer | undefined;

        if (isPdfCoConfigured()) {
          try {
            console.log('[tRPC] sendEmail: Generating PDF via PDF.co...');
            pdfBuffer = await generatePdfFromUrl({
              url: printUrl,
              fileName: `quote-${quote.reference}.pdf`,
            });
            console.log('[tRPC] sendEmail: PDF generated successfully, size:', pdfBuffer.length);
          } catch (pdfError) {
            console.error('[tRPC] sendEmail: PDF generation failed:', pdfError);
            // Continue without PDF attachment - send link only
            pdfBuffer = undefined;
          }
        } else {
          console.log('[tRPC] sendEmail: PDF.co not configured, sending link only');
        }

        // Send email with PDF attachment or link
        console.log('[tRPC] sendEmail: Sending email to:', input.to);
        const emailId = await sendQuoteEmail({
          to: input.to,
          quoteReference: quote.reference,
          clientName: quote.clientName,
          pdfUrl: printUrl,
          pdfBuffer,
        });

        if (!emailId) {
          throw new Error('Email service not configured. Please set RESEND_API_KEY.');
        }

        // Record email send in history
        await ctx.prisma.quote.update({
          where: { id: input.quoteId },
          data: {
            history: {
              create: {
                action: 'EMAIL_SENT',
                payload: {
                  to: input.to,
                  emailId,
                  pdfUrl: printUrl
                }
              }
            }
          }
        });

        console.log('[tRPC] sendEmail: Email sent successfully, ID:', emailId);
        return { emailId, sent: true };
      } catch (error) {
        console.error('[tRPC] sendEmail: Error occurred:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to send email: ${errorMessage}`);
      }
    })
});
