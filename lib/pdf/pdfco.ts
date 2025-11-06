/**
 * PDF.co service for generating PDFs from HTML
 * https://pdf.co/
 */

const PDFCO_API_KEY = process.env.PDFCO_API_KEY;
const PDFCO_API_URL = 'https://api.pdf.co/v1';

export interface GeneratePdfFromUrlOptions {
  url: string;
  fileName?: string;
}

export interface GeneratePdfResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Generate PDF from URL using PDF.co
 */
export async function generatePdfFromUrl(
  options: GeneratePdfFromUrlOptions
): Promise<Buffer> {
  if (!PDFCO_API_KEY) {
    throw new Error('PDFCO_API_KEY is not configured. Please set it in your environment variables.');
  }

  const { url, fileName = 'quote.pdf' } = options;

  console.log('[PDF.co] Generating PDF from URL:', url);

  try {
    // Step 1: Convert HTML to PDF
    const response = await fetch(`${PDFCO_API_URL}/pdf/convert/from/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PDFCO_API_KEY,
      },
      body: JSON.stringify({
        url,
        name: fileName,
        async: false, // Synchronous generation
        margins: '0',
        printBackground: true,
        mediaType: 'print', // Use print styles
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PDF.co] API error:', response.status, errorText);
      throw new Error(`PDF.co API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (!result.url) {
      console.error('[PDF.co] No PDF URL in response:', result);
      throw new Error('PDF.co did not return a PDF URL');
    }

    console.log('[PDF.co] PDF generated successfully:', result.url);

    // Step 2: Download the PDF
    const pdfResponse = await fetch(result.url);

    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[PDF.co] PDF downloaded, size:', buffer.length, 'bytes');

    return buffer;
  } catch (error) {
    console.error('[PDF.co] Error generating PDF:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate PDF with PDF.co: ${errorMessage}`);
  }
}

/**
 * Check if PDF.co is configured
 */
export function isPdfCoConfigured(): boolean {
  return !!PDFCO_API_KEY;
}
