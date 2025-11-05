import Papa from 'papaparse';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { ensurePrismaUser } from '@/lib/app-user';

const csvRowSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  unit: z.enum(['per_1k', 'job', 'enclose']),
  fromQty: z.coerce.number().int(),
  toQty: z.coerce.number().int(),
  pricePerThousand: z.coerce.number(),
  makeReadyFixed: z.coerce.number()
});

// SECURITY: Maximum CSV size (10MB)
const MAX_CSV_SIZE = 10 * 1024 * 1024;
const MAX_CSV_ROWS = 10_000;

const parseCsv = (csv: string) => {
  // SECURITY: Validate file size
  if (csv.length > MAX_CSV_SIZE) {
    throw new Error(`CSV file too large. Maximum size is ${MAX_CSV_SIZE / 1024 / 1024}MB`);
  }

  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors.map((error) => error.message).join('; '));
  }

  // SECURITY: Limit row count to prevent DoS
  if (parsed.data.length > MAX_CSV_ROWS) {
    throw new Error(`CSV contains too many rows. Maximum is ${MAX_CSV_ROWS} rows`);
  }

  return parsed.data.map((row) => csvRowSchema.parse(row));
};

export const importRouter = createTRPCRouter({
  preview: protectedProcedure
    .input(z.object({ csv: z.string().min(1).max(MAX_CSV_SIZE) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ensurePrismaUser(ctx.user);
      
      // SECURITY: Rate limit CSV preview
      await checkRateLimit(user.id, RATE_LIMITS.CSV_IMPORT);
      
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
        csv: z.string().min(1).max(MAX_CSV_SIZE),
        fileName: z.string().min(1).max(255).default(() => `rate-card-${Date.now()}.csv`)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ensurePrismaUser(ctx.user);
      
      // SECURITY: Rate limit CSV import (expensive operation)
      await checkRateLimit(user.id, RATE_LIMITS.CSV_IMPORT);
      
      const rows = parseCsv(input.csv);

      // SECURITY: Sanitize file name to prevent path traversal
      const sanitizedFileName = input.fileName
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.\./g, '')
        .substring(0, 255);
      
      if (!sanitizedFileName.endsWith('.csv')) {
        throw new Error('File must have .csv extension');
      }

      // SECURITY: Use service role client for storage operations
      const serviceClient = createSupabaseServiceRoleClient();
      const uploadsBucket = serviceClient.storage.from('imports');
      await uploadsBucket.upload(`/${sanitizedFileName}`, Buffer.from(input.csv, 'utf-8'), {
        contentType: 'text/csv',
        upsert: false // SECURITY: Prevent overwriting existing files
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
