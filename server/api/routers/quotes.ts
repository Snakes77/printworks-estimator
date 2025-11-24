import { Prisma, QuoteCategory } from '@prisma/client';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { calculateLine, calculateQuoteLines, calculateTotals } from '@/lib/pricing';
import { ensurePrismaUser } from '@/lib/app-user';
// Removed verifyQuoteOwnership - shared team access model
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { sendQuoteEmail } from '@/lib/email';
import { generatePdfFromUrl, isPdfCoConfigured } from '@/lib/pdf/pdfco';
import { getNextQuoteNumber } from '@/lib/quote-numbering';

const serialiseLine = (line: {
  id: string;
  quoteId: string;
  rateCardId: string;
  description: string;
  unitPricePerThousand: Prisma.Decimal;
  makeReadyFixed: Prisma.Decimal;
  unitsInThousands: Prisma.Decimal;
  lineTotalExVat: Prisma.Decimal;
  category: QuoteCategory | null;
  isManualItem: boolean;
  manualQuantity: Prisma.Decimal | null;
  pricePerItem: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...line,
  category: line.category ?? 'PRINT',
  unitPricePerThousand: Number(line.unitPricePerThousand),
  makeReadyFixed: Number(line.makeReadyFixed),
  unitsInThousands: Number(line.unitsInThousands),
  lineTotalExVat: Number(line.lineTotalExVat),
  manualQuantity: line.manualQuantity ? Number(line.manualQuantity) : null,
  pricePerItem: line.pricePerItem ? Number(line.pricePerItem) : null
});

const serialiseTotals = (totals: ReturnType<typeof calculateTotals>) => ({
  subtotal: totals.subtotal.toNumber(),
  discount: totals.discount.toNumber(),
  discountPercentage: totals.discountPercentage.toNumber(),
  total: totals.total.toNumber(),
  categoryTotals: {
    ENVELOPES: totals.categoryTotals.ENVELOPES.toNumber(),
    PRINT: totals.categoryTotals.PRINT.toNumber(),
    DATA_PROCESSING: totals.categoryTotals.DATA_PROCESSING.toNumber(),
    PERSONALISATION: totals.categoryTotals.PERSONALISATION.toNumber(),
    FINISHING: totals.categoryTotals.FINISHING.toNumber(),
    ENCLOSING: totals.categoryTotals.ENCLOSING.toNumber(),
    POSTAGE: totals.categoryTotals.POSTAGE.toNumber()
  },
  pricePerThousand: totals.pricePerThousand.toNumber()
});

const lineSelectionSchema = z.object({
  rateCardId: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().int().positive().optional(), // Line-specific quantity
  // For custom/bespoke line items
  customDescription: z.string().optional(),
  customSetupCharge: z.number().optional(),
  customPrice: z.number().optional(),
  customPricingUnit: z.enum(['per_1000', 'per_item']).optional()
});

const quotePayloadSchema = z.object({
  clientName: z.string().trim().min(2).max(200),
  projectName: z.string().trim().min(1).max(200),
  reference: z.string().trim().min(1).max(100),
  quantity: z.number().int().positive().max(1_000_000),
  discountPercentage: z.number().min(0).max(100).default(0),
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
      // Shared access: All team members can see all quotes
      const where = {
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
            lineTotalExVat: new Decimal(line.lineTotalExVat.toString()),
            category: line.category ?? 'PRINT'
          })),
          quote.quantity,
          Number(quote.discountPercentage)
        );

        return {
          id: quote.id,
          clientName: quote.clientName,
          projectName: quote.projectName,
          reference: quote.reference,
          quantity: quote.quantity,
          pdfUrl: quote.pdfUrl,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
          totals: serialiseTotals(totals)
        };
      });
    }),
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const user = await ensurePrismaUser(ctx.user);

    // Shared access: Any team member can view any quote

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
        lineTotalExVat: new Decimal(line.lineTotalExVat.toString()),
        category: line.category ?? 'PRINT'
      })),
      quote.quantity,
      Number(quote.discountPercentage)
    );

    return {
      id: quote.id,
      clientName: quote.clientName,
      projectName: quote.projectName,
      reference: quote.reference,
      quantity: quote.quantity,
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
    const rateCardLines = input.lines.filter(line => line.rateCardId);
    const customLines = input.lines.filter(line => line.customDescription);

    const rateCards = await ctx.prisma.rateCard.findMany({
      where: { id: { in: rateCardLines.map((line) => line.rateCardId!) } },
      include: { bands: { orderBy: { fromQty: 'asc' } } }
    });

    const orderedCards = rateCardLines.map((line) => {
      const card = rateCards.find((rc) => rc.id === line.rateCardId);
      if (!card) {
        throw new Error(`Rate card ${line.rateCardId} not found`);
      }
      return card;
    });

    const calculatedLines = calculateQuoteLines(input.quantity, orderedCards);

    // Add custom lines (default to PRINT category for custom items)
    const allLines = [
      ...calculatedLines,
      ...customLines.map(line => ({
        rateCardId: 'custom',
        description: line.customDescription!,
        unitPricePerThousand: new Decimal(0),
        makeReadyFixed: new Decimal(0),
        unitsInThousands: new Decimal(0),
        lineTotalExVat: new Decimal(line.customPrice ?? 0),
        category: 'PRINT' as QuoteCategory // Default custom items to PRINT
      }))
    ];

    const totals = calculateTotals(allLines, input.quantity, input.discountPercentage);

    return {
      lines: allLines.map((line) => ({
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

    // Generate quote number if not provided
    let baseReference = input.reference;
    let reference = input.reference;
    let revisionNumber = 0;
    
    // If reference is not in Q00001 format, generate a new one
    if (!input.reference.match(/^Q\d{5}(-\d+)?$/)) {
      const quoteNumber = await getNextQuoteNumber();
      baseReference = quoteNumber.baseReference;
      reference = quoteNumber.reference;
      revisionNumber = 0;
    } else {
      // Extract base reference from Q00001-1 format
      const match = input.reference.match(/^(Q\d{5})(?:-(\d+))?$/);
      if (match) {
        baseReference = match[1]!;
        revisionNumber = match[2] ? parseInt(match[2]!, 10) : 0;
        reference = input.reference;
      }
    }

    const rateCardLines = input.lines.filter(line => line.rateCardId);
    const customLines = input.lines.filter(line => line.customDescription);

    const rateCards = await ctx.prisma.rateCard.findMany({
      where: { id: { in: rateCardLines.map((line) => line.rateCardId!) } },
      include: { bands: { orderBy: { fromQty: 'asc' } } }
    });

    const orderedCards = rateCardLines.map((line) => {
      const card = rateCards.find((rc) => rc.id === line.rateCardId);
      if (!card) {
        throw new Error(`Rate card ${line.rateCardId} not found`);
      }
      return card;
    });

    const lineCalculations = orderedCards.map((card, index) => {
      const line = rateCardLines[index];
      const lineQty = line.quantity ?? input.quantity; // Use line quantity or fallback to quote quantity
      const band = card.bands.find(
        (b) => lineQty >= b.fromQty && lineQty <= b.toQty
      );
      if (!band) {
        throw new Error(`No band for ${card.name} at quantity ${lineQty}`);
      }
      return calculateLine(card, band, lineQty);
    });

    // Add custom lines (default to PRINT category for custom items)
    const customLineCalculations = customLines.map(line => {
      const lineQty = line.quantity ?? input.quantity; // Use line quantity or fallback to quote quantity
      const setupCharge = new Decimal(line.customSetupCharge ?? 0);
      const price = new Decimal(line.customPrice ?? 0);
      const unit = line.customPricingUnit ?? 'per_1000';

      // Calculate based on pricing unit
      let total: Decimal;
      if (unit === 'per_item') {
        total = setupCharge.plus(price.times(lineQty));
      } else {
        // per_1000
        total = setupCharge.plus(price.times(lineQty).div(1000));
      }

      return {
        rateCardId: 'custom',
        description: line.customDescription!,
        unitPricePerThousand: unit === 'per_1000' ? price : new Decimal(0),
        makeReadyFixed: setupCharge,
        unitsInThousands: new Decimal(lineQty).div(1000),
        lineTotalExVat: total,
        category: 'PRINT' as QuoteCategory
      };
    });

    const allLineCalculations = [...lineCalculations, ...customLineCalculations];
    const totals = calculateTotals(allLineCalculations, input.quantity, input.discountPercentage);

    const quote = await ctx.prisma.quote.create({
      data: {
        userId: user.id,
        discountPercentage: new Prisma.Decimal(input.discountPercentage.toString()),
        clientName: input.clientName,
        projectName: input.projectName,
        baseReference,
        revisionNumber,
        reference,
        quantity: input.quantity,
        vatRate: new Prisma.Decimal(0), // Quotes don't include VAT, set to 0 for backward compatibility
        lines: {
          create: allLineCalculations.map((line) => ({
            rateCardId: line.rateCardId,
            description: line.description,
            unitPricePerThousand: new Prisma.Decimal(line.unitPricePerThousand.toString()),
            makeReadyFixed: new Prisma.Decimal(line.makeReadyFixed.toString()),
            unitsInThousands: new Prisma.Decimal(line.unitsInThousands.toString()),
            lineTotalExVat: new Prisma.Decimal(line.lineTotalExVat.toString()),
            category: line.category,
            isManualItem: line.rateCardId === 'custom'
          }))
        },
        history: {
          create: {
            action: 'CREATED',
            payload: {
              lines: allLineCalculations.map((line) => ({
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

      // Shared access: Any team member can update any quote

      const existing = await ctx.prisma.quote.findUnique({
        where: { id: input.id },
        include: { lines: true }
      });

      if (!existing) {
        throw new Error('Quote not found');
      }

      await ctx.prisma.quoteLine.deleteMany({ where: { quoteId: existing.id } });

      const rateCardLines = input.lines.filter(line => line.rateCardId);
      const customLines = input.lines.filter(line => line.customDescription);

      const rateCards = await ctx.prisma.rateCard.findMany({
        where: { id: { in: rateCardLines.map((line) => line.rateCardId!) } },
        include: { bands: { orderBy: { fromQty: 'asc' } } }
      });

      const orderedCards = rateCardLines.map((line) => {
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
        return calculateLine(card, band, input.quantity);
      });

      // Add custom lines (default to PRINT category for custom items)
      const customLineCalculations = customLines.map(line => ({
        rateCardId: 'custom',
        description: line.customDescription!,
        unitPricePerThousand: new Decimal(0),
        makeReadyFixed: new Decimal(0),
        unitsInThousands: new Decimal(0),
        lineTotalExVat: new Decimal(line.customPrice ?? 0),
        category: 'PRINT' as QuoteCategory // Default custom items to PRINT
      }));

      const allLineCalculations = [...lineCalculations, ...customLineCalculations];
      const totals = calculateTotals(allLineCalculations, input.quantity, input.discountPercentage);

      // Track what changed for history
      const changes: string[] = [];

      if (existing.quantity !== input.quantity) {
        changes.push(`Quantity: ${existing.quantity.toLocaleString()} → ${input.quantity.toLocaleString()}`);
      }
      if (existing.clientName !== input.clientName) {
        changes.push(`Client: "${existing.clientName}" → "${input.clientName}"`);
      }
      if (existing.projectName !== input.projectName) {
        changes.push(`Project: "${existing.projectName}" → "${input.projectName}"`);
      }
      if (Number(existing.discountPercentage) !== input.discountPercentage) {
        changes.push(`Discount: ${existing.discountPercentage}% → ${input.discountPercentage}%`);
      }

      // Track line changes
      const existingLineIds = existing.lines.map(l => l.rateCardId).filter(Boolean).sort();
      const newLineIds = input.lines.map(l => l.rateCardId).filter((id): id is string => Boolean(id)).sort();

      const addedLines = newLineIds.filter(id => !existingLineIds.includes(id));
      const removedLines = existingLineIds.filter(id => !newLineIds.includes(id));

      if (addedLines.length > 0) {
        const addedNames = addedLines.map(id => {
          const card = rateCards.find(rc => rc.id === id);
          return card?.name || 'Unknown';
        });
        changes.push(`Added: ${addedNames.join(', ')}`);
      }

      if (removedLines.length > 0) {
        const removedNames = removedLines.map(id => {
          const line = existing.lines.find(l => l.rateCardId === id);
          return line?.description || 'Unknown';
        });
        changes.push(`Removed: ${removedNames.join(', ')}`);
      }

      const updated = await ctx.prisma.quote.update({
        where: { id: input.id },
        data: {
          clientName: input.clientName,
          projectName: input.projectName,
          reference: input.reference,
          quantity: input.quantity,
          discountPercentage: new Prisma.Decimal(input.discountPercentage.toString()),
          vatRate: new Prisma.Decimal(0), // Quotes don't include VAT, set to 0 for backward compatibility
          lines: {
            create: allLineCalculations.map((line) => ({
              rateCardId: line.rateCardId,
              description: line.description,
              unitPricePerThousand: new Prisma.Decimal(line.unitPricePerThousand.toString()),
              makeReadyFixed: new Prisma.Decimal(line.makeReadyFixed.toString()),
              unitsInThousands: new Prisma.Decimal(line.unitsInThousands.toString()),
              lineTotalExVat: new Prisma.Decimal(line.lineTotalExVat.toString()),
              category: line.category,
              isManualItem: line.rateCardId === 'custom'
            }))
          },
        history: {
          create: {
            action: 'UPDATED',
            payload: {
              changes,
              lines: allLineCalculations.map((line) => ({
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

        // Rate limit PDF generation
        await checkRateLimit(user.id, RATE_LIMITS.PDF_GENERATION);

        // Shared access: Any team member can generate PDFs for any quote

        // Get quote details
        const quote = await ctx.prisma.quote.findUnique({
          where: { id: input.quoteId },
          include: { lines: true }
        });

        if (!quote) {
          throw new Error('Quote not found');
        }

        // Generate PDF using PDF.co
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
        const printUrl = `${baseUrl}/quotes/${input.quoteId}/print`;

        if (!isPdfCoConfigured()) {
          throw new Error('PDF.co is not configured. Please set PDFCO_API_KEY.');
        }

        console.log('[tRPC] generatePdf: Generating PDF via PDF.co...');
        const pdfBuffer = await generatePdfFromUrl({
          url: printUrl,
          fileName: `quote-${quote.reference}.pdf`,
        });

        console.log('[tRPC] generatePdf: PDF generated successfully, size:', pdfBuffer.length);

        // Upload to Supabase Storage
        const serviceClient = createSupabaseServiceRoleClient();
        const storage = serviceClient.storage.from('quotes');
        const filePath = `${input.quoteId}.pdf`;

        const uploadResult = await storage.upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

        if (uploadResult.error) {
          console.error('[tRPC] generatePdf: Upload error:', uploadResult.error);
          throw new Error(`Failed to upload PDF: ${uploadResult.error.message}`);
        }

        // Get signed URL (valid for 1 hour)
        const { data: signedUrlData } = await storage.createSignedUrl(filePath, 3600);
        if (!signedUrlData?.signedUrl) {
          throw new Error('Failed to generate signed URL');
        }

        const pdfUrl = signedUrlData.signedUrl;
        console.log('[tRPC] generatePdf: PDF uploaded and URL generated');

        // Add to history
        await ctx.prisma.quote.update({
          where: { id: input.quoteId },
          data: {
            pdfUrl,
            history: {
              create: {
                action: 'PDF_GENERATED',
                payload: {
                  pdfUrl,
                  fileSize: pdfBuffer.length,
                  timestamp: new Date().toISOString(),
                }
              }
            }
          }
        });

        return {
          pdfUrl,
          success: true,
        };
      } catch (error) {
        console.error('[tRPC] generatePdf: Error occurred:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to generate PDF: ${errorMessage}`);
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

        // Shared access: Any team member can send emails for any quote

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
    }),
  updateStatus: protectedProcedure
    .input(z.object({
      quoteId: z.string(),
      status: z.enum(['DRAFT', 'SENT', 'WON', 'LOST'])
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ensurePrismaUser(ctx.user);

      // Update quote status and add to history
      await ctx.prisma.quote.update({
        where: { id: input.quoteId },
        data: {
          status: input.status,
          history: {
            create: {
              action: 'STATUS_CHANGED',
              payload: {
                status: input.status,
                timestamp: new Date().toISOString()
              }
            }
          }
        }
      });

      return { success: true };
    })
});
