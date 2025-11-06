import Decimal from 'decimal.js';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/pricing';
import { verifyQuoteOwnership } from '@/lib/auth';

const getExecutablePath = async () => {
  // Production: always use @sparticuz/chromium
  if (process.env.NODE_ENV === 'production') {
    return chromium.executablePath();
  }

  // Local development: try to find Chrome/Chromium
  // 1. Check environment variable first
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  // 2. Try common Mac locations
  const fs = await import('fs/promises');
  const commonPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  for (const path of commonPaths) {
    try {
      await fs.access(path);
      return path;
    } catch {
      // Path doesn't exist, try next
      continue;
    }
  }

  // 3. Fallback to Chromium package (may download binary)
  console.warn('[PDF] No Chrome/Chromium found in common locations. Using @sparticuz/chromium (may download binary).');
  console.warn('[PDF] For better performance, set CHROME_EXECUTABLE_PATH environment variable.');
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

export const generateQuotePdfBuffer = async (
  quoteId: string,
  userId: string,
  cookies?: Array<{ name: string; value: string }>
) => {
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
    }))
  );

  // SECURITY: Only navigate to our own domain - prevent SSRF
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const validatedUrl = validateUrl(siteUrl);
  const pdfUrl = `${validatedUrl.origin}/quotes/${quoteId}/print`;
  
  console.log('[PDF] PDF URL:', pdfUrl);

  const isProduction = process.env.NODE_ENV === 'production';
  let browser;

  try {
    console.log('[PDF] Starting PDF generation for quote:', quoteId);
    console.log('[PDF] Environment:', isProduction ? 'production' : 'development');
    
    // Get executable path
    const executablePath = await getExecutablePath();
    console.log('[PDF] Executable path:', executablePath || 'not found');
    
    if (!executablePath) {
      throw new Error('Chrome/Chromium executable not found. Please set CHROME_EXECUTABLE_PATH environment variable.');
    }
    
    // Verify executable exists and is accessible
    try {
      const fs = await import('fs/promises');
      await fs.access(executablePath);
      console.log('[PDF] Executable verified:', executablePath);
    } catch (accessError) {
      console.error('[PDF] Executable path not accessible:', executablePath);
      throw new Error(`Chrome executable not accessible at ${executablePath}. Please check CHROME_EXECUTABLE_PATH.`);
    }

    // Configure browser launch options
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      executablePath,
    };

    if (isProduction) {
      // CRITICAL: Use chromium.args directly - do NOT modify them
      // @sparticuz/chromium configures library paths and other required settings
      console.log('[PDF] Using @sparticuz/chromium configuration for Vercel');
      launchOptions.args = chromium.args;
      launchOptions.defaultViewport = chromium.defaultViewport;
      launchOptions.headless = chromium.headless;
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
    
    // SECURITY: Set cookies for authentication if provided
    if (cookies && cookies.length > 0) {
      console.log('[PDF] Setting authentication cookies...');
      await page.setCookie(...cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: new URL(pdfUrl).hostname,
        path: '/',
        httpOnly: cookie.name.includes('auth') || cookie.name.includes('supabase'), // Mark auth cookies as httpOnly
      })));
      console.log('[PDF] Cookies set:', cookies.length);
    }
    
    console.log('[PDF] Navigating to:', pdfUrl);
    await page.goto(pdfUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 // SECURITY: 30 second timeout to prevent hanging
    });
    
    // CRITICAL: Wait for body to be ready
    console.log('[PDF] Waiting for page body...');
    await page.waitForSelector('body', { timeout: 5000 });
    
    // Wait for fonts to load
    console.log('[PDF] Waiting for fonts to load...');
    await page.evaluate(() => document.fonts.ready);
    
    // Wait for #ready marker (simple and reliable)
    console.log('[PDF] Waiting for #ready marker...');
    try {
      await page.waitForSelector('#ready', { timeout: 10000 });
      console.log('[PDF] ✅ #ready marker found');
    } catch (error) {
      console.warn('[PDF] ⚠️ #ready not found, checking content...');
      const bodyContent = await page.evaluate(() => document.body.innerHTML.length);
      console.log('[PDF] Body content length:', bodyContent);
      if (bodyContent < 100) {
        throw new Error('Page appears to be empty');
      }
    }
    
    // Additional wait for fonts/images
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify content exists
    const contentCheck = await page.evaluate(() => {
      const body = document.body.innerHTML;
      return {
        bodyLength: body.length,
        hasReady: !!document.getElementById('ready'),
        hasTable: body.includes('<table'),
        hasHeader: body.includes('DMC Encore') || body.includes('QUOTATION'),
      };
    });
    console.log('[PDF] Content check:', contentCheck);
    
    if (!contentCheck.hasTable || !contentCheck.hasHeader) {
      throw new Error('Page content incomplete - missing expected elements');
    }
    
    console.log('[PDF] Generating PDF...');
    const pdf = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0'
      }
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
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[PDF] Error details:', {
      message: errorMessage,
      stack: errorStack,
      quoteId,
      pdfUrl,
      isProduction
    });
    
    // SECURITY: Ensure browser is closed even on error
    if (browser) {
      await browser.close().catch((closeError) => {
        console.error('[PDF] Error closing browser:', closeError);
      });
    }
    
    // Provide helpful error message based on error type
    let userFriendlyMessage = 'PDF generation failed. Please check server logs for details.';
    
    if (errorMessage.includes('spawn') || errorMessage.includes('ENOENT') || errorMessage.includes('Unknown system error')) {
      userFriendlyMessage = 'Chrome/Chromium not found. For local development, set CHROME_EXECUTABLE_PATH environment variable or install Chrome.';
    } else if (errorMessage.includes('libnss3') || errorMessage.includes('shared libraries')) {
      userFriendlyMessage = 'Chromium libraries missing. This should be handled by @sparticuz/chromium. Please check Vercel configuration.';
    } else if (errorMessage.includes('timeout')) {
      userFriendlyMessage = 'PDF generation timed out. The quote page may be taking too long to load.';
    } else if (errorMessage.includes('navigation')) {
      userFriendlyMessage = 'Failed to load quote page. Please ensure the quote exists and is accessible.';
    }
    
    throw new Error(`${userFriendlyMessage} Error: ${errorMessage}`);
  }
};