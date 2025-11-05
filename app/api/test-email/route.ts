import { NextResponse } from 'next/server';
import { sendTestEmail, isEmailConfigured } from '@/lib/email';

/**
 * API Route to test email functionality
 * POST /api/test-email
 * Body: { email: "your@email.com" }
 */
export async function POST(request: Request) {
  try {
    // Check if email is configured
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Email service not configured. Please set RESEND_API_KEY in your environment variables.' },
        { status: 400 }
      );
    }

    // Get email from request body
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address. Please provide a valid email.' },
        { status: 400 }
      );
    }

    // Send test email
    const emailId = await sendTestEmail(email);

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${email}`,
      emailId,
    });
  } catch (error) {
    console.error('[API] Test email error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to send test email: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check email configuration status
 */
export async function GET() {
  const configured = isEmailConfigured();
  return NextResponse.json({
    configured,
    message: configured 
      ? 'Email service is configured and ready to use.' 
      : 'Email service not configured. Set RESEND_API_KEY to enable.',
  });
}

