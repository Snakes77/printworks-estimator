'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
    status: 'DRAFT' | 'SENT' | 'WON' | 'LOST';
    pdfUrl: string | null;
    createdAt: string;
    updatedAt: string;
    lines: QuoteLine[];
    history: QuoteHistoryEntry[];
    totals: {
      subtotal: number;
      discount?: number;
      discountPercentage?: number;
      total: number;
    };
  };
};

export const QuoteView = ({ quote }: QuoteViewProps) => {
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const utils = trpc.useUtils();

  const updateStatus = trpc.quotes.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Quote status updated');
      utils.quotes.get.invalidate({ id: quote.id });
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    }
  });

  const generatePdf = trpc.quotes.generatePdf.useMutation({
    onSuccess: (data) => {
      toast.success('PDF generated successfully.');
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      }
    },
    onError: (error) => {
      console.error('PDF generation error:', error);
      const errorMessage = error.message || 'Unable to generate the PDF.';
      toast.error(errorMessage);
    }
  });

  const sendEmail = trpc.quotes.sendEmail.useMutation({
    onSuccess: () => {
      toast.success('Email sent successfully!');
      setEmailOpen(false);
      setEmailAddress('');
    },
    onError: (error) => {
      console.error('Email send error:', error);
      const errorMessage = error.message || 'Unable to send email.';
      toast.error(errorMessage);
    }
  });

  const handleGeneratePdf = () => {
    generatePdf.mutate({ quoteId: quote.id }, {
      onSuccess: (data) => {
        if (data.pdfUrl) {
          // Download the PDF
          const link = document.createElement('a');
          link.href = data.pdfUrl;
          link.download = `quote-${quote.reference}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          toast.success('PDF generated and downloaded!');
        }
      },
      onError: (error) => {
        console.error('PDF generation error:', error);
        toast.error('Failed to generate PDF: ' + error.message);
      }
    });
  };

  const handleSendEmail = () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    sendEmail.mutate({ quoteId: quote.id, to: emailAddress });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{quote.clientName}</h1>
            <p className="text-sm text-slate-600">
              Reference {quote.reference} · Updated {format(new Date(quote.updatedAt), 'dd MMM yyyy HH:mm')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="status" className="text-sm font-medium">Status:</Label>
            <Select
              id="status"
              value={quote.status}
              onChange={(e) => updateStatus.mutate({ quoteId: quote.id, status: e.target.value as any })}
              disabled={updateStatus.isPending}
              className="w-auto"
            >
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" asChild>
            <Link href={`/quotes/${quote.id}/edit`}>Edit quote</Link>
          </Button>
          <Button variant="secondary" onClick={handleGeneratePdf} disabled={generatePdf.isPending}>
            {generatePdf.isPending ? 'Generating PDF...' : 'Generate PDF'}
          </Button>
          <Button
            variant="primary"
            onClick={() => setEmailOpen(!emailOpen)}
            disabled={sendEmail.isPending}
          >
            {sendEmail.isPending ? 'Sending…' : 'Send Email'}
          </Button>
        </div>
        {emailOpen && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Send Quote by Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Recipient Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="client@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSendEmail();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSendEmail} 
                  disabled={sendEmail.isPending || !emailAddress}
                >
                  {sendEmail.isPending ? 'Sending…' : 'Send'}
                </Button>
                <Button variant="secondary" onClick={() => {
                  setEmailOpen(false);
                  setEmailAddress('');
                }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
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
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">{formatGBP(quote.totals.subtotal)}</span>
              </div>
              {(quote.totals.discount ?? 0) > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Discount ({quote.totals.discountPercentage ?? 0}%)</span>
                  <span className="font-mono text-red-600">-{formatGBP(quote.totals.discount ?? 0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-lg font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total</span>
                <span className="font-mono">{formatGBP(quote.totals.total)}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <dl className="space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <dt>Quantity</dt>
                <dd>{quote.quantity.toLocaleString('en-GB')}</dd>
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
          {quote.history.map((entry) => {
            const renderPayload = () => {
              const payload = entry.payload as Record<string, unknown>;
              
              // Handle EMAIL_SENT action
              if (entry.action === 'EMAIL_SENT' && payload.to) {
                const emailTo = String(payload.to);
                const emailId = payload.emailId ? String(payload.emailId) : null;
                return (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <p>Email sent to: <span className="font-medium">{emailTo}</span></p>
                    {emailId && (
                      <p className="text-slate-400">Email ID: {emailId.substring(0, 8)}...</p>
                    )}
                  </div>
                );
              }
              
              // Handle CREATED action
              if (entry.action === 'CREATED' && payload.totals && typeof payload.totals === 'object') {
                const totals = payload.totals as { total?: string | number };
                return (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <p>Total: {formatGBP(Number(totals.total))}</p>
                    <p className="text-slate-400">
                      {Array.isArray(payload.lines) ? `${payload.lines.length} line${payload.lines.length !== 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                );
              }
              
              // Handle PDF_GENERATED action
              if (entry.action === 'PDF_GENERATED') {
                const pdfUrl = payload.pdfUrl ? String(payload.pdfUrl) : null;
                const fileSize = payload.fileSize ? Number(payload.fileSize) : null;
                const fileSizeKB = fileSize ? Math.round(fileSize / 1024) : null;

                return (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {fileSizeKB && <p>File size: {fileSizeKB} KB</p>}
                    {pdfUrl && (
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        View PDF →
                      </a>
                    )}
                  </div>
                );
              }
              
              // Handle UPDATE action or other actions
              if (entry.action === 'UPDATED') {
                const changes = payload.changes as string[] | undefined;
                const totals = payload.totals as { total?: string | number } | undefined;

                return (
                  <div className="mt-1 space-y-1 text-xs text-slate-500">
                    {changes && changes.length > 0 ? (
                      <ul className="list-disc list-inside space-y-0.5">
                        {changes.map((change, idx) => (
                          <li key={idx}>{change}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Quote details updated</p>
                    )}
                    {totals && (
                      <p className="font-medium text-slate-700">New total: {formatGBP(Number(totals.total))}</p>
                    )}
                  </div>
                );
              }
              
              // Fallback for unknown payloads
              if (Object.keys(payload).length > 0) {
                return (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                      View details
                    </summary>
                    <pre className="mt-1 text-xs text-slate-500 overflow-auto">
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </details>
                );
              }
              
              return null;
            };

            return (
              <div key={entry.id} className="flex items-start justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="flex-1">
                  <p className="font-medium text-slate-800 capitalize">
                    {entry.action.replace(/_/g, ' ').toLowerCase()}
                  </p>
                  {renderPayload()}
                </div>
                <span className="ml-4 text-xs text-slate-500 whitespace-nowrap">
                  {format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm')}
                </span>
              </div>
            );
          })}
          {quote.history.length === 0 && <p className="text-slate-500">No history yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
};
