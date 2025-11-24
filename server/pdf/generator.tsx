import Decimal from 'decimal.js';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/pricing';
import { verifyQuoteOwnership } from '@/lib/auth';

const getExecutablePath = async () => {
  // Local development: use environment variable or system Chrome
  if (process.env.NODE_ENV !== 'production') {
    if (process.env.CHROME_EXECUTABLE_PATH) {
      return process.env.CHROME_EXECUTABLE_PATH;
    }
    // Try to use system Chrome/Chromium for local dev
    // Note: puppeteer-core doesn't have executablePath() in the same way
    // For local dev, we'll use Chromium package or require CHROME_EXECUTABLE_PATH
    return chromium.executablePath();
  }

  // Production: always use @sparticuz/chromium
  return chromium.executablePath();
};

/**
 * SECURITY: Validate URL to prevent SSRF attacks
 */
function validateUrl(url: string): URL {
  const parsed = new URL(url);
  
  // Only allow http/https protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid protocol');
  }
  
  // Block internal IP ranges in production
  if (process.env.NODE_ENV === 'production') {
    const hostname = parsed.hostname;
    const blockedPatterns = [
      /^127\./,
      /^169\.254\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^localhost$/i,
      /^0\.0\.0\.0$/
    ];
    
    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      throw new Error('Internal URLs not allowed in production');
    }
  }
  
  return parsed;
}

export const generateQuotePdfBuffer = async (quoteId: string, userId: string) => {
  // SECURITY: Verify ownership before generating PDF
  await verifyQuoteOwnership(quoteId, userId);

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      lines: { orderBy: { createdAt: 'asc' } },
      user: true
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
    })),
    Number(quote.vatRate)
  );

  // SECURITY: Only navigate to our own domain - prevent SSRF
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const validatedUrl = validateUrl(siteUrl);
  const pdfUrl = `${validatedUrl.origin}/quotes/${quoteId}/pdf`;

  const isProduction = process.env.NODE_ENV === 'production';
  let browser;

  try {
    console.log('[PDF] Starting PDF generation for quote:', quoteId);
    console.log('[PDF] Environment:', isProduction ? 'production' : 'development');
    
    // Get executable path
    const executablePath = await getExecutablePath();
    console.log('[PDF] Executable path:', executablePath ? 'found' : 'missing');

    // Configure browser launch options
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      executablePath,
    };

    if (isProduction) {
      // Production: use Chromium package settings
      launchOptions.args = chromium.args;
      launchOptions.defaultViewport = chromium.defaultViewport;
    } else {
      // Development: minimal args for local Chrome
      launchOptions.args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ];
    }

    console.log('[PDF] Launching browser...');
    browser = await puppeteer.launch(launchOptions);
    console.log('[PDF] Browser launched successfully');

    const page = await browser.newPage();
    console.log('[PDF] Navigating to:', pdfUrl);
    
    await page.goto(pdfUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 // SECURITY: 30 second timeout to prevent hanging
    });
    
    console.log('[PDF] Page loaded, generating PDF...');
    const pdf = await page.pdf({ 
      format: 'A4', 
      printBackground: true 
    });
    
    console.log('[PDF] PDF generated successfully, size:', pdf.length, 'bytes');

    return {
      pdf,
      quote,
      totals: {
        subtotal: totals.subtotal.toNumber(),
        total: totals.total.toNumber()
      }
    };
  } catch (error) {
    console.error('[PDF] Generation failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[PDF] Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      quoteId,
      pdfUrl
    });
    
    // SECURITY: Ensure browser is closed even on error
    if (browser) {
      await browser.close().catch((closeError) => {
        console.error('[PDF] Error closing browser:', closeError);
      });
    }
    
    throw new Error(`PDF generation failed: ${errorMessage}. Please check server logs for details.`);
  }
};
