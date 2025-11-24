import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import { calculateTotals, formatGBP } from '@/lib/pricing';

export const runtime = 'nodejs';
export const revalidate = 0;
export const dynamic = 'force-dynamic';

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export default async function PrintPage({ params }: { params?: Promise<{ id: string }> }) {
  if (!params) throw new Error('No params provided');
  const { id } = await params;
  console.log('[Print Page] Fetching quote:', id);

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!quote) {
    console.log('[Print Page] Quote not found:', id);
    notFound();
  }

  console.log('[Print Page] Quote found, lines:', quote.lines.length);

  const totals = calculateTotals(
    quote.lines.map((line) => ({
      rateCardId: line.rateCardId,
      description: line.description,
      unitPricePerThousand: new Decimal(line.unitPricePerThousand.toString()),
      makeReadyFixed: new Decimal(line.makeReadyFixed.toString()),
      unitsInThousands: new Decimal(line.unitsInThousands.toString()),
      lineTotalExVat: new Decimal(line.lineTotalExVat.toString()),
    })),
    Number(quote.discountPercentage)
  );

  return (
    <html lang="en">
      <head>
        <title>Quote {quote.reference} - DMC Encore</title>
        <style dangerouslySetInnerHTML={{ __html: `
          @page {
            margin: 0;
            size: A4;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: white;
            color: #000000;
            padding: 0;
            line-height: 1.4;
          }
          .page {
            width: 210mm;
            height: 297mm;
            padding: 20mm 25mm;
            margin: 0 auto;
            background: white;
          }
          /* Clean Professional Header */
          header {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #000000;
          }
          .header-left img {
            height: 45px;
            width: auto;
            margin-bottom: 8px;
          }
          .company-info {
            font-size: 10px;
            line-height: 1.6;
            color: #000000;
          }
          .company-name {
            font-weight: 700;
            margin-bottom: 4px;
          }
          .header-right {
            text-align: right;
          }
          .doc-type {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 8px;
            color: #000000;
          }
          .quote-info {
            font-size: 10px;
            line-height: 1.8;
          }
          .quote-info-label {
            display: inline-block;
            width: 120px;
            text-align: left;
          }
          .quote-info-value {
            font-weight: 600;
          }
          /* Client Section */
          .client-section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 2px solid #000000;
            display: inline-block;
          }
          .client-details {
            margin-top: 12px;
            font-size: 10px;
            line-height: 1.6;
          }
          .client-name {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 2px;
          }
          .project-details {
            display: grid;
            grid-template-columns: 120px 1fr;
            gap: 8px;
            margin-top: 12px;
          }
          .detail-label {
            color: #666666;
          }
          .detail-value {
            font-weight: 600;
          }
          /* QUOTATION Title */
          .quotation-title {
            font-size: 24px;
            font-weight: 300;
            margin-bottom: 20px;
            letter-spacing: -0.5px;
          }
          /* Clean Table */
          .table-section {
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead {
            background: #E5E7EB;
            border-top: 1px solid #000000;
            border-bottom: 1px solid #000000;
          }
          th {
            text-align: left;
            padding: 10px 12px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #000000;
          }
          th.right {
            text-align: right;
          }
          tbody tr {
            border-bottom: 1px solid #E5E7EB;
          }
          td {
            padding: 10px 12px;
            font-size: 10px;
            color: #000000;
          }
          td.right {
            text-align: right;
            font-variant-numeric: tabular-nums;
          }
          td.total {
            font-weight: 700;
          }
          /* Totals Section */
          .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
          }
          .totals-box {
            width: 300px;
            background: #F3F4F6;
            padding: 16px 20px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 8px;
          }
          .total-row.grand {
            background: #1F2937;
            color: white;
            margin: 8px -20px -16px -20px;
            padding: 14px 20px;
            font-size: 13px;
            font-weight: 700;
          }
          .total-label {
            text-transform: uppercase;
            font-size: 10px;
          }
          .total-amount {
            font-weight: 700;
            font-variant-numeric: tabular-nums;
          }
          /* Footer */
          footer {
            position: absolute;
            bottom: 20mm;
            left: 25mm;
            right: 25mm;
            padding-top: 16px;
            border-top: 1px solid #D1D5DB;
            font-size: 9px;
            color: #666666;
            line-height: 1.6;
          }
          .footer-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .footer-company {
            font-weight: 700;
            color: #000000;
            margin-bottom: 4px;
          }
          #ready {
            display: none;
          }
        ` }} />
      </head>
      <body>
        <div className="page">
          <header>
            <div className="header-left">
              <img
                src="https://dmc-encore.co.uk/wp-content/uploads/2022/01/dmc-colour-logo.png"
                alt="DMC Encore"
              />
              <div className="company-info">
                <div className="company-name">DMC Encore</div>
                <div>Direct mail, fulfilment and logistics specialists</div>
                <div>Fulfilment: 01604 790060</div>
                <div>Direct Mail: 0116 507 7860</div>
              </div>
            </div>
            <div className="header-right">
              <div className="doc-type">QUOTATION</div>
              <div className="quote-info">
                <div><span className="quote-info-label">Quote Number</span><span className="quote-info-value">{quote.reference}</span></div>
                <div><span className="quote-info-label">Quote Date</span><span className="quote-info-value">{formatDate(quote.createdAt)}</span></div>
              </div>
            </div>
          </header>

          <div className="client-section">
            <div className="section-title">Bill To</div>
            <div className="client-details">
              <div className="client-name">{quote.clientName}</div>
              <div>{quote.projectName}</div>
            </div>
            <div className="project-details">
              <span className="detail-label">Quantity</span>
              <span className="detail-value">{quote.quantity.toLocaleString('en-GB')}</span>
            </div>
          </div>

          <h2 className="quotation-title">QUOTATION</h2>

          <div className="table-section">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="right">Units (k)</th>
                  <th className="right">Unit Price</th>
                  <th className="right">Make-ready</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line, index) => (
                  <tr key={index}>
                    <td>{line.description}</td>
                    <td className="right">{Number(line.unitsInThousands).toFixed(3)}</td>
                    <td className="right">{formatGBP(Number(line.unitPricePerThousand))}</td>
                    <td className="right">{formatGBP(Number(line.makeReadyFixed))}</td>
                    <td className="right total">{formatGBP(Number(line.lineTotalExVat))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totals-section">
            <div className="totals-box">
              <div className="total-row">
                <span className="total-label">Net Amount (GBP)</span>
                <span className="total-amount">{formatGBP(totals.subtotal)}</span>
              </div>
              {totals.discount.toNumber() > 0 && (
                <div className="total-row">
                  <span className="total-label">Discount ({totals.discountPercentage.toNumber()}%)</span>
                  <span className="total-amount" style={{ color: '#dc2626' }}>-{formatGBP(totals.discount)}</span>
                </div>
              )}
              <div className="total-row grand">
                <span className="total-label">Grand Total (GBP)</span>
                <span className="total-amount">{formatGBP(totals.total)}</span>
              </div>
            </div>
          </div>

          <footer>
            <div className="footer-grid">
              <div>
                <div className="footer-company">DMC Encore</div>
                <div>Please contact us if you have any questions about this estimate.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Quote generated on {formatDateTime(new Date())}</div>
                <div style={{ fontSize: '10px', color: '#999', marginTop: '8px' }}>
                  <span style={{ color: '#ff2e63', fontWeight: 600 }}>Powered by Staxxd</span> — data-driven automation built in the UK
                </div>
              </div>
            </div>
          </footer>

          <div id="ready"></div>
        </div>
      </body>
    </html>
  );
}
