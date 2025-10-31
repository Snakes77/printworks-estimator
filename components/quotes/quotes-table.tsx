'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatGBP } from '@/lib/pricing';

export const QuotesTable = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'draft' | 'final'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const quotesQuery = trpc.quotes.list.useQuery({ search });

  const rows = useMemo(() => {
    if (!quotesQuery.data) return [];
    return quotesQuery.data.filter((quote) => {
      if (status === 'all') return true;
      const isFinal = Boolean(quote.pdfUrl);
      const matchesStatus = status === 'final' ? isFinal : !isFinal;
      if (!matchesStatus) return false;

      if (!selectedDate) return true;
      const comparisonDate = new Date(selectedDate).toDateString();
      const quoteDate = new Date(quote.updatedAt).toDateString();
      return comparisonDate === quoteDate;
    });
  }, [quotesQuery.data, status, selectedDate]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Input
          placeholder="Filter by client or reference"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="final">Final</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Envelope</TableHead>
              <TableHead className="text-right">Inserts</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">VAT</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((quote) => (
              <TableRow key={quote.id}>
                <TableCell>{quote.clientName}</TableCell>
                <TableCell>{quote.reference}</TableCell>
                <TableCell className="text-right">{quote.quantity.toLocaleString('en-GB')}</TableCell>
                <TableCell>{quote.envelopeType}</TableCell>
                <TableCell className="text-right">{quote.insertsCount}</TableCell>
                <TableCell className="text-right">{formatGBP(quote.totals.subtotal)}</TableCell>
                <TableCell className="text-right">{formatGBP(quote.totals.vat)}</TableCell>
                <TableCell className="text-right">{formatGBP(quote.totals.total)}</TableCell>
                <TableCell>{new Date(quote.updatedAt).toLocaleDateString('en-GB')}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="secondary" className="px-3 py-1 text-xs">
                      <Link href={`/quotes/${quote.id}`}>View</Link>
                    </Button>
                    <Button asChild variant="ghost" className="px-3 py-1 text-xs">
                      <Link href={`/quotes/${quote.id}/edit`}>Edit</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-6 text-center text-sm text-slate-500">
                  {quotesQuery.isLoading ? 'Loading quotes…' : 'No quotes match your filters yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
