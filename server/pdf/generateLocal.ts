import puppeteer from 'puppeteer';

/**
 * Generate PDF for a quote using local Puppeteer (full version)
 * Returns PDF buffer for local development
 */
export async function generateLocalPdf(quoteId: string): Promise<Buffer> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const url = `${baseUrl}/quotes/${quoteId}/print`;

  console.log('[generateLocalPdf] Starting PDF generation');
  console.log('[generateLocalPdf] Quote ID:', quoteId);
  console.log('[generateLocalPdf] URL:', url);

  let browser;
  try {
    // Launch browser
    console.log('[generateLocalPdf] Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    console.log('[generateLocalPdf] ✓ Browser launched');

    const page = await browser.newPage();

    // Enable console logging from the page
    page.on('console', (msg) => {
      console.log('[generateLocalPdf] Page console:', msg.type(), msg.text());
    });

    // Log page errors
    page.on('pageerror', (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[generateLocalPdf] Page error:', errorMessage);
    });

    // Log failed requests
    page.on('requestfailed', (request) => {
      console.error('[generateLocalPdf] Request failed:', request.url());
    });

    // Navigate to print page
    console.log('[generateLocalPdf] Navigating to print page...');
    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    console.log('[generateLocalPdf] ✓ Page loaded, status:', response?.status());

    // Wait for the ready marker
    console.log('[generateLocalPdf] Waiting for #ready marker...');
    await page.waitForSelector('#ready', { timeout: 10000 });
    console.log('[generateLocalPdf] ✓ #ready marker found');

    // Additional wait for any fonts/images
    await page.evaluate(() => document.fonts.ready);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify content exists
    const hasContent = await page.evaluate(() => {
      const body = document.body.innerHTML;
      const ready = document.getElementById('ready');
      return {
        bodyLength: body.length,
        hasReady: !!ready,
        hasTable: body.includes('<table'),
        hasHeader: body.includes('DMC Encore'),
      };
    });

    console.log('[generateLocalPdf] Content check:', hasContent);

    if (!hasContent.hasTable || !hasContent.hasHeader) {
      throw new Error('Page content incomplete - missing expected elements');
    }

    // Generate PDF
    console.log('[generateLocalPdf] Generating PDF...');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    });

    console.log('[generateLocalPdf] ✓ PDF generated, size:', pdf.length, 'bytes');

    await browser.close();
    console.log('[generateLocalPdf] ✓ Browser closed');

    return Buffer.from(pdf);
  } catch (error) {
    console.error('[generateLocalPdf] ❌ Error:', error);
    if (browser) {
      await browser.close().catch((e) => {
        console.error('[generateLocalPdf] Error closing browser:', e);
      });
    }
    throw error;
  }
}

