'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { trpc } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatGBP } from '@/lib/pricing';

const quoteSchema = z.object({
  clientName: z.string().min(2, 'Client name is required'),
  projectName: z.string().min(1, 'Project name is required'),
  reference: z.string().min(1, 'Reference is required'),
  quantity: z.coerce.number().int().positive('Quantity must be a whole number'),
  envelopeType: z.string().min(1),
  insertsCount: z.coerce.number().int().min(0)
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

type RateCard = {
  id: string;
  code: string;
  name: string;
  unit: string;
  notes?: string | null;
  bands: {
    id: string;
    fromQty: number;
    toQty: number;
    pricePerThousand: number;
    makeReadyFixed: number;
  }[];
};

type PreviewLine = {
  rateCardId: string;
  description: string;
  unitPricePerThousand: number;
  makeReadyFixed: number;
  unitsInThousands: number;
  lineTotalExVat: number;
};

type ExistingQuote = {
  id: string;
  clientName: string;
  projectName: string;
  reference: string;
  quantity: number;
  envelopeType: string;
  insertsCount: number;
  lines: PreviewLine[];
  totals: {
    subtotal: number;
    total: number;
  };
};

type LineRow = PreviewLine & { code: string };

const envelopeOptions = ['C5', 'C4', 'DL'];

type QuoteBuilderProps = {
  rateCards: RateCard[];
  existingQuote?: ExistingQuote;
};

export const QuoteBuilder = ({ rateCards, existingQuote }: QuoteBuilderProps) => {
  const router = useRouter();
  const [selectedRateCardIds, setSelectedRateCardIds] = useState<string[]>(
    existingQuote ? existingQuote.lines.map((line) => line.rateCardId) : []
  );
  const [selectedCardId, setSelectedCardId] = useState('');
  const preview = trpc.quotes.preview.useMutation();
  const createQuote = trpc.quotes.create.useMutation();
  const updateQuote = trpc.quotes.update.useMutation();
  const generatePdf = trpc.quotes.generatePdf.useMutation();

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: existingQuote
      ? {
          clientName: existingQuote.clientName,
          projectName: existingQuote.projectName,
          reference: existingQuote.reference,
          quantity: existingQuote.quantity,
          envelopeType: existingQuote.envelopeType,
          insertsCount: existingQuote.insertsCount
        }
      : {
          clientName: '',
          projectName: '',
          reference: '',
          quantity: 20000,
          envelopeType: 'C5',
          insertsCount: 1
        }
  });

  const quantity = form.watch('quantity');
  const insertsCount = form.watch('insertsCount');

  // Preview for currently selected (but not yet added) rate card
  const selectedCardPreview = trpc.quotes.preview.useMutation();

  useEffect(() => {
    if (!selectedRateCardIds.length) {
      return;
    }

    const values = form.getValues();
    preview.mutate({
      ...values,
      lines: selectedRateCardIds.map((id) => ({ rateCardId: id }))
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRateCardIds, quantity, insertsCount]);

  // Live preview when a card is selected in dropdown
  useEffect(() => {
    if (!selectedCardId) {
      return;
    }

    const values = form.getValues();
    selectedCardPreview.mutate({
      ...values,
      lines: [{ rateCardId: selectedCardId }]
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardId, quantity, insertsCount]);

  const availableCards = useMemo(
    () => rateCards.filter((card) => !selectedRateCardIds.includes(card.id)),
    [rateCards, selectedRateCardIds]
  );

  const selectedCards = useMemo(
    () => selectedRateCardIds.map((id) => rateCards.find((card) => card.id === id)!).filter(Boolean),
    [selectedRateCardIds, rateCards]
  );

  const lineRows: LineRow[] = useMemo(() => {
    if (!preview.data) {
      return selectedCards.map((card) => {
        const existing = existingQuote?.lines.find((line) => line.rateCardId === card.id);
        return {
          rateCardId: card.id,
          description: card.name,
          unitPricePerThousand: existing?.unitPricePerThousand ?? 0,
          makeReadyFixed: existing?.makeReadyFixed ?? 0,
          unitsInThousands: existing?.unitsInThousands ?? 0,
          lineTotalExVat: existing?.lineTotalExVat ?? 0,
          code: card.code
        };
      });
    }

    return selectedCards.map((card) => {
      const line = preview.data?.lines.find((item) => item.rateCardId === card.id);
      return {
        rateCardId: card.id,
        description: card.name,
        unitPricePerThousand: line?.unitPricePerThousand ?? 0,
        makeReadyFixed: line?.makeReadyFixed ?? 0,
        unitsInThousands: line?.unitsInThousands ?? 0,
        lineTotalExVat: line?.lineTotalExVat ?? 0,
        code: card.code
      };
    });
  }, [selectedCards, preview.data, existingQuote]);

  const totals = preview.data?.totals ?? existingQuote?.totals ?? { subtotal: 0, total: 0 };
  const isEditing = Boolean(existingQuote);

  const columns = useMemo<ColumnDef<LineRow>[]>(
    () => [
      {
        accessorKey: 'description',
        header: 'Operation',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-900">{row.original.description}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">{row.original.code}</p>
          </div>
        )
      },
      {
        accessorKey: 'unitsInThousands',
        header: 'Units (k)',
        cell: ({ getValue }) => <span className="text-right tabular-nums">{Number(getValue() ?? 0).toFixed(3)}</span>
      },
      {
        accessorKey: 'unitPricePerThousand',
        header: 'Unit £/1k',
        cell: ({ getValue }) => <span className="text-right tabular-nums">{formatGBP(Number(getValue() ?? 0))}</span>
      },
      {
        accessorKey: 'makeReadyFixed',
        header: 'Make-ready',
        cell: ({ getValue }) => <span className="text-right tabular-nums">{formatGBP(Number(getValue() ?? 0))}</span>
      },
      {
        accessorKey: 'lineTotalExVat',
        header: 'Line total',
        cell: ({ getValue }) => <span className="text-right font-semibold tabular-nums">{formatGBP(Number(getValue() ?? 0))}</span>
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            className="text-xs text-red-600"
            onClick={() =>
              setSelectedRateCardIds((current) => current.filter((id) => id !== row.original.rateCardId))
            }
          >
            Remove
          </Button>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data: lineRows,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const addRateCard = () => {
    if (!selectedCardId) return;
    setSelectedRateCardIds((current) => [...new Set([...current, selectedCardId])]);
    setSelectedCardId('');
  };

  const onSubmit = form.handleSubmit(async (values, event) => {
    if (!selectedRateCardIds.length) {
      toast.error('Add at least one operation to build a quote.');
      return;
    }

    try {
      const payload = {
        ...values,
        lines: selectedRateCardIds.map((id) => ({ rateCardId: id }))
      };

      const result = isEditing
        ? await updateQuote.mutateAsync({ id: existingQuote!.id, ...payload })
        : await createQuote.mutateAsync(payload);

      toast.success(isEditing ? 'Quote updated successfully.' : 'Quote saved successfully.');

      const submitter = (event?.nativeEvent as SubmitEvent)?.submitter;
      if (submitter instanceof HTMLButtonElement && submitter.name === 'finalise') {
        await generatePdf.mutateAsync({ quoteId: result.id });
        toast.success('PDF generated and stored.');
      }

      router.push(`/quotes/${result.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Unable to save the quote. Please try again.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[2fr,3fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Quote details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client</Label>
              <Input id="clientName" placeholder="ABC Ltd" {...form.register('clientName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectName">Project</Label>
              <Input id="projectName" placeholder="Project description" {...form.register('projectName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" placeholder="Qtest1" {...form.register('reference')} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" type="number" min={1} {...form.register('quantity', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="envelopeType">Envelope</Label>
                <Select
                  id="envelopeType"
                  value={form.watch('envelopeType')}
                  onChange={(event) => form.setValue('envelopeType', event.target.value)}
                >
                  {envelopeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insertsCount">Inserts</Label>
              <Input id="insertsCount" type="number" min={0} {...form.register('insertsCount', { valueAsNumber: true })} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <Select value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)}>
                <option value="">Select operation</option>
                {availableCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={addRateCard} disabled={!selectedCardId}>
                Add operation
              </Button>
            </div>
            {selectedCardId && selectedCardPreview.data && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-medium text-slate-500">UNITS (K)</p>
                    <p className="mt-0.5 font-mono text-slate-900">
                      {selectedCardPreview.data.lines[0]?.unitsInThousands.toFixed(3) ?? '0.000'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">UNIT £/1K</p>
                    <p className="mt-0.5 font-mono text-slate-900">
                      {formatGBP(selectedCardPreview.data.lines[0]?.unitPricePerThousand ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">MAKE-READY</p>
                    <p className="mt-0.5 font-mono text-slate-900">
                      {formatGBP(selectedCardPreview.data.lines[0]?.makeReadyFixed ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="text-right first:text-left">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="text-right first:text-left">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {table.getRowModel().rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="py-6 text-center text-sm text-slate-500">
                        Select operations to build your quote.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatGBP(totals.total ?? 0)}</span>
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              type="submit"
              variant="secondary"
              disabled={createQuote.isPending || updateQuote.isPending}
            >
              {isEditing ? 'Update draft' : 'Save draft'}
            </Button>
            <Button
              type="submit"
              name="finalise"
              disabled={createQuote.isPending || updateQuote.isPending || generatePdf.isPending}
            >
              {isEditing ? 'Update and finalise' : 'Save and finalise'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
};
