import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '2.0.0-browser-pdf',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
    // This helps verify which code is running
    pdfMethod: 'browser-based',
    commitMessage: 'feat: Switch to browser-based PDF generation (Ctrl+P)',
  });
}
