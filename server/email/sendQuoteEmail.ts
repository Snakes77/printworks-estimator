import { Resend } from 'resend';
import { BRAND_CONFIG } from '@/lib/brand';

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const fromName = BRAND_CONFIG.name;

export type SendQuoteEmailParams = {
  to: string;
  quoteReference: string;
  clientName: string;
  pdfUrl: string;
  fallbackUrl?: string;
};

/**
 * Send quote email with PDF link or fallback print page
 */
export async function sendQuoteEmail(params: SendQuoteEmailParams): Promise<string> {
  if (!resend) {
    throw new Error('Resend not configured. Set RESEND_API_KEY environment variable.');
  }

  const linkUrl = params.pdfUrl || params.fallbackUrl || '#';
  const linkText = params.pdfUrl ? 'View Quote PDF' : 'View Quote';

  console.log('[Email] Sending quote email to:', params.to);
  console.log('[Email] PDF URL:', params.pdfUrl || 'none (using fallback)');

  try {
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [params.to],
      subject: `Quote ${params.quoteReference} - ${BRAND_CONFIG.name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quote ${params.quoteReference}</title>
          </head>
          <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="border-bottom: 2px solid ${BRAND_CONFIG.colors.primary}; padding-bottom: 16px; margin-bottom: 24px;">
              <h1 style="color: ${BRAND_CONFIG.colors.primary}; margin: 0 0 8px 0; font-size: 24px;">
                ${BRAND_CONFIG.name}
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">${BRAND_CONFIG.tagline}</p>
            </div>
            
            <div style="margin-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Dear ${params.clientName},</p>
              <p style="margin: 0 0 16px 0;">
                Please find your quotation reference <strong>${params.quoteReference}</strong>.
              </p>
              <p style="margin: 0 0 16px 0;">
                <a href="${linkUrl}" style="color: ${BRAND_CONFIG.colors.primary}; text-decoration: underline; font-weight: 600;">${linkText}</a>
              </p>
              <p style="margin: 0 0 16px 0;">
                If you have any questions about this estimate, please don't hesitate to contact us.
              </p>
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 32px; font-size: 12px; color: #6b7280;">
              <p style="margin: 0 0 4px 0;"><strong>${BRAND_CONFIG.name}</strong></p>
              <p style="margin: 0 0 4px 0;">Fulfilment: ${BRAND_CONFIG.contact.fulfilment}</p>
              <p style="margin: 0;">Direct Mail: ${BRAND_CONFIG.contact.directMail}</p>
            </div>
          </body>
        </html>
      `,
    });

    if (result.error) {
      console.error('[Email] Failed to send email:', result.error);
      throw new Error(`Email send failed: ${result.error.message}`);
    }

    const emailId = result.data?.id || 'unknown';
    console.log('[Email] Email sent successfully. ID:', emailId);
    return emailId;
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    throw error;
  }
}

