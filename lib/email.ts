import { Resend } from 'resend';
import { BRAND_CONFIG } from './brand';

/**
 * Email service using Resend
 * Handles sending quote PDFs and notifications
 */

// Initialize Resend client (will be undefined if API key not configured)
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Default to Resend test domain if no custom domain configured
// For production, set RESEND_FROM_EMAIL to a verified domain (e.g., quotes@dmc-encore.co.uk)
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const fromName = BRAND_CONFIG.name;

export type SendQuoteEmailParams = {
  to: string | string[];
  quoteReference: string;
  clientName: string;
  pdfUrl: string;
  pdfBuffer?: Buffer;
};

/**
 * Send quote PDF via email
 * @param params Email parameters
 * @returns Email ID if successful, null if email not configured
 */
export async function sendQuoteEmail(params: SendQuoteEmailParams): Promise<string | null> {
  if (!resend) {
    console.warn('[Email] Resend not configured. Set RESEND_API_KEY environment variable.');
    return null;
  }

  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  
  try {
    const emailData: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      attachments?: Array<{ filename: string; content: Buffer }>;
    } = {
      from: `${fromName} <${fromEmail}>`,
      to: recipients,
      subject: `Quote ${params.quoteReference} - ${BRAND_CONFIG.name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quote ${params.quoteReference}</title>
          </head>
          <body style="font-family: ${BRAND_CONFIG.fonts.primary}, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="border-bottom: 2px solid ${BRAND_CONFIG.colors.primary}; padding-bottom: 16px; margin-bottom: 24px;">
              <h1 style="color: ${BRAND_CONFIG.colors.primary}; margin: 0 0 8px 0; font-size: 24px;">
                ${BRAND_CONFIG.name}
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">${BRAND_CONFIG.tagline}</p>
            </div>
            
            <div style="margin-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Dear ${params.clientName},</p>
              <p style="margin: 0 0 16px 0;">
                Please find attached your quotation reference <strong>${params.quoteReference}</strong>.
              </p>
              <p style="margin: 0 0 16px 0;">
                You can also view the PDF online: <a href="${params.pdfUrl}" style="color: ${BRAND_CONFIG.colors.primary}; text-decoration: underline;">View Quote PDF</a>
              </p>
              <p style="margin: 0 0 16px 0;">
                If you have any questions about this estimate, please don't hesitate to contact us.
              </p>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 32px; font-size: 12px; color: #6b7280;">
              <p style="margin: 0 0 4px 0;"><strong>${BRAND_CONFIG.name}</strong></p>
              <p style="margin: 0 0 4px 0;">Fulfilment: ${BRAND_CONFIG.contact.fulfilment}</p>
              <p style="margin: 0 0 16px 0;">Direct Mail: ${BRAND_CONFIG.contact.directMail}</p>
              <hr style="margin: 16px 0; border: none; border-top: 1px solid #ddd;">
              <p style="font-size: 11px; color: #999; margin: 0;">
                <span style="color: #ff2e63; font-weight: 600;">Powered by Staxxd</span> — data-driven automation built in the UK
              </p>
            </div>
          </body>
        </html>
      `,
    };

    // If PDF buffer is provided, attach it
    if (params.pdfBuffer) {
      emailData.attachments = [
        {
          filename: `quote-${params.quoteReference}.pdf`,
          content: params.pdfBuffer,
        },
      ];
    }

    const result = await resend.emails.send(emailData);

    if (result.error) {
      console.error('[Email] Failed to send email:', result.error);
      throw new Error(`Email send failed: ${result.error.message}`);
    }

    console.log('[Email] Quote email sent successfully to:', recipients.join(', '));
    return result.data?.id || null;
  } catch (error) {
    console.error('[Email] Error sending quote email:', error);
    throw error;
  }
}

/**
 * Send a test email to verify Resend configuration
 * @param to Email address to send test to
 * @returns Email ID if successful
 */
export async function sendTestEmail(to: string): Promise<string> {
  if (!resend) {
    throw new Error('Resend not configured. Set RESEND_API_KEY environment variable.');
  }

  try {
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Test Email - ${BRAND_CONFIG.name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Test Email</title>
          </head>
          <body style="font-family: ${BRAND_CONFIG.fonts.primary}, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="border-bottom: 2px solid ${BRAND_CONFIG.colors.primary}; padding-bottom: 16px; margin-bottom: 24px;">
              <h1 style="color: ${BRAND_CONFIG.colors.primary}; margin: 0 0 8px 0; font-size: 24px;">
                ${BRAND_CONFIG.name}
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">${BRAND_CONFIG.tagline}</p>
            </div>
            
            <div style="margin-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Hello!</p>
              <p style="margin: 0 0 16px 0;">
                This is a <strong>test email</strong> to verify that Resend email service is configured correctly.
              </p>
              <p style="margin: 0 0 16px 0;">
                ✅ If you received this email, your Resend API key is working!
              </p>
              <p style="margin: 0 0 16px 0;">
                You can now send quote PDFs via email in the PrintWorks Estimator app.
              </p>
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 32px; font-size: 12px; color: #6b7280;">
              <p style="margin: 0 0 4px 0;"><strong>${BRAND_CONFIG.name}</strong></p>
              <p style="margin: 0 0 4px 0;">Fulfilment: ${BRAND_CONFIG.contact.fulfilment}</p>
              <p style="margin: 0 0 16px 0;">Direct Mail: ${BRAND_CONFIG.contact.directMail}</p>
              <hr style="margin: 16px 0; border: none; border-top: 1px solid #ddd;">
              <p style="font-size: 11px; color: #999; margin: 0;">
                <span style="color: #ff2e63; font-weight: 600;">Powered by Staxxd</span> — data-driven automation built in the UK
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (result.error) {
      console.error('[Email] Test email failed:', result.error);
      throw new Error(`Test email failed: ${result.error.message}`);
    }

    console.log('[Email] ✅ Test email sent successfully to:', to);
    console.log('[Email] Email ID:', result.data?.id);
    return result.data?.id || 'unknown';
  } catch (error) {
    console.error('[Email] Error sending test email:', error);
    throw error;
  }
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!resend && !!process.env.RESEND_API_KEY;
}
