import Decimal from 'decimal.js';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/pricing';

const getExecutablePath = async () => {
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  return chromium.executablePath();
};

export const generateQuotePdfBuffer = async (quoteId: string) => {
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

  // Use Puppeteer to navigate to the PDF route
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const pdfUrl = `${siteUrl}/quotes/${quoteId}/pdf`;

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await getExecutablePath(),
    headless: true
  });

  const page = await browser.newPage();
  await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  return {
    pdf,
    quote,
    totals: {
      subtotal: totals.subtotal.toNumber(),
      vat: totals.vat.toNumber(),
      total: totals.total.toNumber()
    }
  };
};
