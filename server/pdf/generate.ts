import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';

/**
 * Generate PDF for a quote and upload to Supabase Storage
 * Returns the public URL
 */
export async function generateQuotePdf(quoteId: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/quotes/${quoteId}/print`;

  let browser;
  try {
    // Launch Chromium
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    // Navigate and wait for content
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('#ready', { timeout: 5000 });

    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });

    await browser.close();

    // Upload to Supabase Storage
    const supabase = createSupabaseServiceRoleClient();
    const storage = supabase.storage.from('quotes');
    const filePath = `${quoteId}/${Date.now()}.pdf`;
    
    const { error: uploadError } = await storage.upload(filePath, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL (bucket is public for now)
    // TODO: Switch to signed URLs later: await storage.createSignedUrl(filePath, 3600)
    const { data } = storage.getPublicUrl(filePath);
    
    if (!data?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    return data.publicUrl;
  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    console.error('[PDF] Generation failed:', error);
    throw error;
  }
}

