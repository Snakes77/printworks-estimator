import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateLocalPdf } from '@/server/pdf/generateLocal';
import { generateQuotePdfBuffer } from '@/server/pdf/generator';
import { sendQuoteEmail } from '@/server/email/sendQuoteEmail';
import { upsertClientByEmail } from '@/lib/client';
import { getAuthenticatedUser } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const issueSchema = z.object({
  to: z.string().email(),
});

/**
 * Issue quote - generate PDF and send email
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const { id } = await props.params;
    const body = await request.json();
    const { to } = issueSchema.parse(body);

    // Verify quote exists and user owns it
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Upsert client by email for quick lookup later
    await upsertClientByEmail({
      email: to,
      name: quote.clientName,
    });

    // Generate PDF if not already generated
    let pdfUrl = quote.pdfUrl;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const fallbackUrl = `${baseUrl}/quotes/${id}/print`;

    if (!pdfUrl) {
      console.log(`[Issue] Generating PDF for quote ${id}`);
      try {
        // Generate PDF buffer - use production generator on Vercel, local otherwise
        let pdfBuffer: Buffer;
        if (process.env.NODE_ENV === 'production') {
          // Production: use generator.tsx with @sparticuz/chromium
          const result = await generateQuotePdfBuffer(id, user.id);
          pdfBuffer = Buffer.from(result.pdf);
        } else {
          // Development: use local Puppeteer
          pdfBuffer = await generateLocalPdf(id);
        }
        console.log(`[Issue] PDF generated: ${pdfBuffer.length} bytes`);

        // Upload to Supabase Storage
        const supabase = createSupabaseServiceRoleClient();
        const storage = supabase.storage.from('quotes');
        const filePath = `${id}.pdf`;
        
        const { error: uploadError } = await storage.upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

        if (uploadError) {
          console.error('[Issue] Storage upload failed:', uploadError);
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data } = storage.getPublicUrl(filePath);
        if (!data?.publicUrl) {
          throw new Error('Failed to get public URL');
        }

        pdfUrl = data.publicUrl;
        console.log(`[Issue] PDF uploaded, URL: ${pdfUrl}`);
        
        // Save PDF URL to quote
        await prisma.quote.update({
          where: { id },
          data: { pdfUrl },
        });
      } catch (pdfError) {
        console.error('[Issue] PDF generation failed:', pdfError);
        // Continue to send email with fallback link
        pdfUrl = null;
      }
    }

    // Send email (always send, even if PDF failed)
    console.log(`[Issue] Sending email to ${to} for quote ${id}`);
    const emailId = await sendQuoteEmail({
      to,
      quoteReference: quote.reference,
      clientName: quote.clientName,
      pdfUrl: pdfUrl || '',
      fallbackUrl: pdfUrl ? undefined : fallbackUrl,
    });

    // Log audit event
    await prisma.quoteHistory.create({
      data: {
        quoteId: id,
        action: 'EMAIL_SENT',
        payload: {
          to,
          emailId,
          pdfUrl,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      pdfUrl: pdfUrl || fallbackUrl,
      emailId,
      pdfGenerated: !!pdfUrl,
    });
  } catch (error) {
    console.error('[Issue] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

