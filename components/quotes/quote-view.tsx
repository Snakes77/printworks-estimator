'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatGBP } from '@/lib/pricing';

type QuoteLine = {
  id: string;
  description: string;
  unitsInThousands: number;
  unitPricePerThousand: number;
  makeReadyFixed: number;
  lineTotalExVat: number;
};

type QuoteHistoryEntry = {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type QuoteViewProps = {
  quote: {
    id: string;
    clientName: string;
    projectName: string;
    reference: string;
    quantity: number;
    envelopeType: string;
    insertsCount: number;
    vatRate: number;
    pdfUrl: string | null;
    createdAt: string;
    updatedAt: string;
    lines: QuoteLine[];
    history: QuoteHistoryEntry[];
    totals: {
      subtotal: number;
      vat: number;
      total: number;
    };
  };
};

export const QuoteView = ({ quote }: QuoteViewProps) => {
  const generatePdf = trpc.quotes.generatePdf.useMutation({
    onSuccess: (data) => {
      toast.success('PDF generated successfully.');
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      }
    },
    onError: () => {
      toast.error('Unable to generate the PDF.');
    }
  });

  const handleGeneratePdf = () => {
    generatePdf.mutate({ quoteId: quote.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{quote.clientName}</h1>
          <p className="text-sm text-slate-600">
            Reference {quote.reference} · Updated {format(new Date(quote.updatedAt), 'dd MMM yyyy HH:mm')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" asChild>
            <Link href={`/quotes/${quote.id}/edit`}>Edit quote</Link>
          </Button>
          <Button variant="secondary" onClick={handleGeneratePdf} disabled={generatePdf.isPending}>
            {generatePdf.isPending ? 'Generating…' : 'Generate PDF'}
          </Button>
          {quote.pdfUrl && (
            <Button asChild>
              <Link href={quote.pdfUrl} target="_blank" rel="noopener noreferrer">
                Download PDF
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Units (k)</TableHead>
                  <TableHead className="text-right">Unit £/1k</TableHead>
                  <TableHead className="text-right">Make-ready</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-right">{line.unitsInThousands.toFixed(3)}</TableCell>
                    <TableCell className="text-right">{formatGBP(line.unitPricePerThousand)}</TableCell>
                    <TableCell className="text-right">{formatGBP(line.makeReadyFixed)}</TableCell>
                    <TableCell className="text-right font-medium">{formatGBP(line.lineTotalExVat)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Subtotal (ex VAT)</span>
              <span className="font-medium">{formatGBP(quote.totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">VAT ({quote.vatRate}%)</span>
              <span className="font-medium">{formatGBP(quote.totals.vat)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Total (inc VAT)</span>
              <span>{formatGBP(quote.totals.total)}</span>
            </div>
          </CardContent>
          <CardFooter>
            <dl className="space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <dt>Quantity</dt>
                <dd>{quote.quantity.toLocaleString('en-GB')}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Envelope</dt>
                <dd>{quote.envelopeType}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Inserts</dt>
                <dd>{quote.insertsCount}</dd>
              </div>
            </dl>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {quote.history.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="font-medium text-slate-800">{entry.action.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-500">{JSON.stringify(entry.payload)}</p>
              </div>
              <span className="text-xs text-slate-500">{format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm')}</span>
            </div>
          ))}
          {quote.history.length === 0 && <p className="text-slate-500">No history yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
};
