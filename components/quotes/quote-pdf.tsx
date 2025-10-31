import { format } from 'date-fns';
import { formatGBP } from '@/lib/pricing';

type QuoteLine = {
  description: string;
  unitsInThousands: number;
  unitPricePerThousand: number;
  makeReadyFixed: number;
  lineTotalExVat: number;
};

type QuotePdfProps = {
  quote: {
    id: string;
    clientName: string;
    projectName: string;
    reference: string;
    quantity: number;
    envelopeType: string;
    insertsCount: number;
    vatRate: number;
    createdAt: Date;
    lines: QuoteLine[];
  };
  totals: {
    subtotal: number;
    vat: number;
    total: number;
  };
};

export const QuotePdf = ({ quote, totals }: QuotePdfProps) => {
  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', padding: '48px', background: 'white', color: '#1f2937' }}>
      <header style={{ borderBottom: '2px solid #1f4e79', paddingBottom: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', margin: 0, color: '#1f4e79' }}>PrintWorks Estimator</h1>
        <p style={{ marginTop: '8px' }}>Quotation reference {quote.reference}</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '16px', marginBottom: '8px', color: '#1f4e79' }}>Client</h2>
          <p style={{ margin: 0, fontWeight: 600 }}>{quote.clientName}</p>
          <p style={{ margin: 0 }}>{quote.projectName}</p>
        </div>
        <div>
          <h2 style={{ fontSize: '16px', marginBottom: '8px', color: '#1f4e79' }}>Summary</h2>
          <p style={{ margin: '0 0 4px 0' }}>Quantity: {quote.quantity.toLocaleString('en-GB')}</p>
          <p style={{ margin: '0 0 4px 0' }}>Envelope: {quote.envelopeType}</p>
          <p style={{ margin: '0 0 4px 0' }}>Inserts: {quote.insertsCount}</p>
          <p style={{ margin: 0 }}>Date: {format(quote.createdAt, 'dd MMMM yyyy')}</p>
        </div>
      </section>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #d1d5db', padding: '12px 8px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Description</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #d1d5db', padding: '12px 8px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Units (k)</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #d1d5db', padding: '12px 8px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Unit £/1k</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #d1d5db', padding: '12px 8px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Make-ready</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #d1d5db', padding: '12px 8px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Line total</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((line) => (
            <tr key={line.description}>
              <td style={{ padding: '12px 8px', borderBottom: '1px solid #e5e7eb' }}>{line.description}</td>
              <td style={{ padding: '12px 8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {line.unitsInThousands.toFixed(3)}
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {formatGBP(line.unitPricePerThousand)}
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {formatGBP(line.makeReadyFixed)}
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
                {formatGBP(line.lineTotalExVat)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section style={{ marginLeft: 'auto', width: '260px', fontSize: '14px', borderTop: '2px solid #1f4e79', paddingTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Subtotal (ex VAT)</span>
          <span style={{ fontWeight: 600 }}>{formatGBP(totals.subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>VAT ({quote.vatRate}%)</span>
          <span style={{ fontWeight: 600 }}>{formatGBP(totals.vat)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, color: '#1f4e79' }}>
          <span>Total (inc VAT)</span>
          <span>{formatGBP(totals.total)}</span>
        </div>
      </section>

      <footer style={{ marginTop: '48px', fontSize: '12px', color: '#6b7280' }}>
        <p style={{ margin: 0 }}>Quote generated on {format(new Date(), 'dd MMMM yyyy HH:mm')}.</p>
        <p style={{ margin: '4px 0 0 0' }}>Please contact us if you have any questions about this estimate.</p>
      </footer>
    </div>
  );
};
