import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendQuoteEmail } from '@/lib/email';
import { upsertClientByEmail } from '@/lib/client';
import { getAuthenticatedUser } from '@/lib/auth';

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

    // Use print URL instead of generating PDF
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const printUrl = `${baseUrl}/quotes/${id}/print`;

    // Send email with print URL
    console.log(`[Issue] Sending email to ${to} for quote ${id}`);
    const emailId = await sendQuoteEmail({
      to,
      quoteReference: quote.reference,
      clientName: quote.clientName,
      pdfUrl: printUrl,
    });

    // Log audit event
    await prisma.quoteHistory.create({
      data: {
        quoteId: id,
        action: 'EMAIL_SENT',
        payload: {
          to,
          emailId,
          pdfUrl: printUrl,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      pdfUrl: printUrl,
      emailId,
      pdfGenerated: false, // Browser-based PDF now
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

