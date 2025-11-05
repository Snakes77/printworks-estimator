import { format } from 'date-fns';
import { formatGBP } from '@/lib/pricing';
import { BRAND_CONFIG } from '@/lib/brand';

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
    createdAt: Date;
    lines: QuoteLine[];
  };
  totals: {
    subtotal: number;
    total: number;
  };
};

export const QuotePdf = ({ quote, totals }: QuotePdfProps) => {
  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif', 
      padding: '40px 50px', 
      background: 'white', 
      color: '#000000',
      maxWidth: '210mm',
      margin: '0 auto'
    }}>
      {/* Header with Logo and Quote Info */}
      <header style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '60px',
        marginBottom: '40px', 
        paddingBottom: '20px', 
        borderBottom: `2px solid ${BRAND_CONFIG.colors.primary}` 
      }}>
        <div>
          <img 
            src={BRAND_CONFIG.logo.url} 
            alt={BRAND_CONFIG.logo.alt}
            style={{ height: '50px', width: 'auto', marginBottom: '12px' }}
          />
          <div style={{ fontSize: '11px', lineHeight: '1.6', color: '#000000' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '12px' }}>{BRAND_CONFIG.name}</div>
            <div>{BRAND_CONFIG.tagline}</div>
            <div style={{ marginTop: '8px' }}>Fulfilment: {BRAND_CONFIG.contact.fulfilment}</div>
            <div>Direct Mail: {BRAND_CONFIG.contact.directMail}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', color: BRAND_CONFIG.colors.primary }}>
            QUOTATION
          </div>
          <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
            <div><span style={{ display: 'inline-block', width: '100px', textAlign: 'left' }}>Quote Number:</span><span style={{ fontWeight: 600 }}>{quote.reference}</span></div>
            <div><span style={{ display: 'inline-block', width: '100px', textAlign: 'left' }}>Quote Date:</span><span style={{ fontWeight: 600 }}>{format(quote.createdAt, 'dd MMMM yyyy')}</span></div>
          </div>
        </div>
      </header>

      {/* Client Section */}
      <section style={{ marginBottom: '40px' }}>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 700, 
          textTransform: 'uppercase', 
          marginBottom: '12px', 
          paddingBottom: '6px', 
          borderBottom: `2px solid ${BRAND_CONFIG.colors.primary}`, 
          display: 'inline-block',
          color: BRAND_CONFIG.colors.primary
        }}>
          Bill To
        </div>
        <div style={{ marginTop: '12px', fontSize: '11px', lineHeight: '1.6' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{quote.clientName}</div>
          <div style={{ color: '#666666' }}>{quote.projectName}</div>
        </div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '100px 1fr', 
          gap: '8px', 
          marginTop: '16px',
          fontSize: '11px'
        }}>
          <span style={{ color: '#666666' }}>Quantity:</span>
          <span style={{ fontWeight: 600 }}>{quote.quantity.toLocaleString('en-GB')}</span>
          <span style={{ color: '#666666' }}>Envelope:</span>
          <span style={{ fontWeight: 600 }}>{quote.envelopeType}</span>
          <span style={{ color: '#666666' }}>Inserts:</span>
          <span style={{ fontWeight: 600 }}>{quote.insertsCount}</span>
        </div>
      </section>

      {/* Quotation Title */}
      <h2 style={{ 
        fontSize: '28px', 
        fontWeight: 300, 
        marginBottom: '30px', 
        letterSpacing: '-0.5px',
        color: BRAND_CONFIG.colors.primary
      }}>
        QUOTATION
      </h2>

      {/* Items Table */}
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse', 
        marginBottom: '30px',
        borderTop: `1px solid ${BRAND_CONFIG.colors.primary}`,
        borderBottom: `1px solid ${BRAND_CONFIG.colors.primary}`
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px', 
              fontSize: '10px', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase', 
              color: '#000000', 
              fontWeight: 700,
              borderBottom: `1px solid ${BRAND_CONFIG.colors.primary}`
            }}>
              Description
            </th>
            <th style={{ 
              textAlign: 'right', 
              padding: '12px', 
              fontSize: '10px', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase', 
              color: '#000000', 
              fontWeight: 700,
              borderBottom: `1px solid ${BRAND_CONFIG.colors.primary}`
            }}>
              Units (k)
            </th>
            <th style={{ 
              textAlign: 'right', 
              padding: '12px', 
              fontSize: '10px', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase', 
              color: '#000000', 
              fontWeight: 700,
              borderBottom: `1px solid ${BRAND_CONFIG.colors.primary}`
            }}>
              Unit Price
            </th>
            <th style={{ 
              textAlign: 'right', 
              padding: '12px', 
              fontSize: '10px', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase', 
              color: '#000000', 
              fontWeight: 700,
              borderBottom: `1px solid ${BRAND_CONFIG.colors.primary}`
            }}>
              Make-ready
            </th>
            <th style={{ 
              textAlign: 'right', 
              padding: '12px', 
              fontSize: '10px', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase', 
              color: '#000000', 
              fontWeight: 700,
              borderBottom: `1px solid ${BRAND_CONFIG.colors.primary}`
            }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((line, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', fontSize: '11px', color: '#000000' }}>{line.description}</td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                {line.unitsInThousands.toFixed(3)}
              </td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                {formatGBP(line.unitPricePerThousand)}
              </td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                {formatGBP(line.makeReadyFixed)}
              </td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {formatGBP(line.lineTotalExVat)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <section style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
        <div style={{ 
          width: '300px', 
          background: '#f3f4f6', 
          padding: '20px 24px',
          borderTop: `2px solid ${BRAND_CONFIG.colors.primary}`
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '12px', 
            marginBottom: '12px',
            color: '#000000'
          }}>
            <span style={{ textTransform: 'uppercase', fontSize: '11px' }}>Net Amount (GBP)</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatGBP(totals.subtotal)}</span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '14px', 
            fontWeight: 700,
            background: BRAND_CONFIG.colors.primary,
            color: 'white',
            margin: '12px -24px -20px -24px',
            padding: '16px 24px',
            fontVariantNumeric: 'tabular-nums'
          }}>
            <span style={{ textTransform: 'uppercase', fontSize: '12px' }}>Grand Total (GBP)</span>
            <span>{formatGBP(totals.total)}</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ 
        marginTop: '60px', 
        fontSize: '10px', 
        color: '#666666', 
        borderTop: '1px solid #d1d5db', 
        paddingTop: '20px',
        lineHeight: '1.6'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontWeight: 700, color: BRAND_CONFIG.colors.primary, marginBottom: '6px' }}>{BRAND_CONFIG.name}</div>
            <div>Please contact us if you have any questions about this estimate.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Quote generated on {format(new Date(), 'dd MMMM yyyy HH:mm')}</div>
          </div>
        </div>
        <div style={{ 
          marginTop: '16px', 
          paddingTop: '16px', 
          borderTop: '1px solid #e5e7eb',
          fontSize: '9px',
          textAlign: 'center',
          color: '#999999'
        }}>
          © Copyright 2025 DMC Encore All Rights Reserved. Registered in England 7262051. VAT no. 992615291.
        </div>
      </footer>
    </div>
  );
};
