import { Prisma } from '@prisma/client';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { calculateLine, calculateQuoteLines, calculateTotals } from '@/lib/pricing';
import { ensurePrismaUser } from '@/lib/app-user';
import { generateQuotePdfBuffer } from '@/server/pdf/generator';
import { verifyQuoteOwnership } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { sendQuoteEmail } from '@/lib/email';

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
        
        // SECURITY: Rate limit PDF generation (expensive operation)
        await checkRateLimit(user.id, RATE_LIMITS.PDF_GENERATION);
        
        // SECURITY: Verify ownership before generating PDF
        await verifyQuoteOwnership(input.quoteId, user.id);

        console.log('[tRPC] generatePdf: Starting PDF generation for quote:', input.quoteId);
        const { pdf, totals } = await generateQuotePdfBuffer(input.quoteId, user.id, ctx.cookies);
        console.log('[tRPC] generatePdf: PDF generated successfully, size:', pdf.length, 'bytes');

        // SECURITY: Use service role client for storage operations
        const serviceClient = createSupabaseServiceRoleClient();
        const storage = serviceClient.storage.from('quotes');
        const filePath = `${input.quoteId}.pdf`;
        console.log('[tRPC] generatePdf: Uploading PDF to storage...');
        const uploadResult = await storage.upload(filePath, pdf, {
          contentType: 'application/pdf',
          upsert: true
        });

        if (uploadResult.error) {
          console.error('[tRPC] generatePdf: Storage upload error:', uploadResult.error);
          throw uploadResult.error;
        }

        console.log('[tRPC] generatePdf: PDF uploaded successfully, generating signed URL...');
        // SECURITY: Generate signed URL instead of public URL (5 minute expiry)
        const {
          data: signedUrlData
        } = await storage.createSignedUrl(filePath, 300); // 5 minutes

        if (!signedUrlData?.signedUrl) {
          throw new Error('Failed to generate signed URL');
        }

        const signedUrl = signedUrlData.signedUrl;
        console.log('[tRPC] generatePdf: Signed URL generated successfully');

        await ctx.prisma.quote.update({
          where: { id: input.quoteId },
          data: {
            pdfUrl: signedUrl,
            history: {
              create: {
                action: 'PDF_GENERATED',
                payload: {
                  pdfUrl: signedUrl,
                  totals
                }
              }
            }
          }
        });

        console.log('[tRPC] generatePdf: Quote updated with PDF URL');
        return { pdfUrl: signedUrl, totals };
      } catch (error) {
        console.error('[tRPC] generatePdf: Error occurred:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('[tRPC] generatePdf: Error details:', {
          message: errorMessage,
          stack: errorStack,
          quoteId: input.quoteId,
          userId: ctx.user?.id
        });
        
        // Re-throw with more context
        throw new Error(`PDF generation failed: ${errorMessage}`);
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

        // Generate PDF if not already generated or URL expired
        let pdfBuffer: Buffer;
        let pdfUrl: string;

        if (quote.pdfUrl) {
          // Try to use existing PDF URL (may be expired)
          pdfUrl = quote.pdfUrl;
          // Still generate PDF buffer for attachment
          console.log('[tRPC] sendEmail: Generating PDF buffer for attachment...');
          const { pdf } = await generateQuotePdfBuffer(input.quoteId, user.id, ctx.cookies);
          pdfBuffer = Buffer.from(pdf);
        } else {
          // Generate PDF and upload
          console.log('[tRPC] sendEmail: Generating PDF...');
          const { pdf, totals } = await generateQuotePdfBuffer(input.quoteId, user.id, ctx.cookies);
          pdfBuffer = Buffer.from(pdf);

          // Upload to storage
          const serviceClient = createSupabaseServiceRoleClient();
          const storage = serviceClient.storage.from('quotes');
          const filePath = `${input.quoteId}.pdf`;
          
          const uploadResult = await storage.upload(filePath, pdf, {
            contentType: 'application/pdf',
            upsert: true
          });

          if (uploadResult.error) {
            throw uploadResult.error;
          }

          // Generate signed URL (24 hours for email)
          const { data: signedUrlData } = await storage.createSignedUrl(filePath, 86400); // 24 hours
          if (!signedUrlData?.signedUrl) {
            throw new Error('Failed to generate signed URL');
          }
          pdfUrl = signedUrlData.signedUrl;

          // Update quote with PDF URL
          await ctx.prisma.quote.update({
            where: { id: input.quoteId },
            data: { pdfUrl }
          });
        }

        // Send email
        console.log('[tRPC] sendEmail: Sending email to:', input.to);
        const emailId = await sendQuoteEmail({
          to: input.to,
          quoteReference: quote.reference,
          clientName: quote.clientName,
          pdfUrl,
          pdfBuffer
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
                  pdfUrl
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
