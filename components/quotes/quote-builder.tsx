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
  discountPercentage: z.coerce.number().min(0).max(100)
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

type RateCard = {
  id: string;
  code: string;
  name: string;
  unit: string;
  notes?: string | null;
  category?: string | null;
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
  discountPercentage?: number;
  lines: PreviewLine[];
  totals: {
    subtotal: number;
    discount?: number;
    discountPercentage?: number;
    total: number;
  };
};

type LineRow = PreviewLine & { code: string };

type QuoteBuilderProps = {
  rateCards: RateCard[];
  existingQuote?: ExistingQuote;
};

type CustomLine = {
  id: string;
  customDescription: string;
  customPrice: number;
};

export const QuoteBuilder = ({ rateCards, existingQuote }: QuoteBuilderProps) => {
  const router = useRouter();
  const [selectedRateCardIds, setSelectedRateCardIds] = useState<string[]>(
    existingQuote ? existingQuote.lines.filter(line => line.rateCardId !== 'custom').map((line) => line.rateCardId) : []
  );
  const [customLines, setCustomLines] = useState<CustomLine[]>(
    existingQuote
      ? existingQuote.lines
          .filter(line => line.rateCardId === 'custom')
          .map(line => ({
            id: line.rateCardId + Math.random(),
            customDescription: line.description,
            customPrice: line.lineTotalExVat
          }))
      : []
  );
  const [selectedCardId, setSelectedCardId] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDescription, setCustomDescription] = useState('');
  const [customPrice, setCustomPrice] = useState('');
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
          discountPercentage: existingQuote.discountPercentage ?? 0
        }
      : {
          clientName: '',
          projectName: '',
          reference: '',
          quantity: 20000,
          discountPercentage: 0
        }
  });

  const quantity = form.watch('quantity');
  const discountPercentage = form.watch('discountPercentage');

  // Preview for currently selected (but not yet added) rate card
  const selectedCardPreview = trpc.quotes.preview.useMutation();

  useEffect(() => {
    if (!selectedRateCardIds.length && !customLines.length) {
      return;
    }

    const values = form.getValues();
    preview.mutate({
      ...values,
      lines: [
        ...selectedRateCardIds.map((id) => ({ rateCardId: id })),
        ...customLines.map((line) => ({ customDescription: line.customDescription, customPrice: line.customPrice }))
      ]
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRateCardIds, customLines, quantity, discountPercentage]);

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
  }, [selectedCardId, quantity, discountPercentage]);

  const availableCards = useMemo(
    () => rateCards.filter((card) => !selectedRateCardIds.includes(card.id)),
    [rateCards, selectedRateCardIds]
  );

  const selectedCards = useMemo(
    () => selectedRateCardIds.map((id) => rateCards.find((card) => card.id === id)!).filter(Boolean),
    [selectedRateCardIds, rateCards]
  );

  // Group rate cards by category
  const rateCardsByCategory = useMemo(() => {
    const categories = ['DATA_PROCESSING', 'PERSONALISATION', 'FINISHING', 'ENCLOSING'] as const;
    return categories.reduce((acc, category) => {
      acc[category] = availableCards.filter(card => card.category === category);
      return acc;
    }, {} as Record<string, RateCard[]>);
  }, [availableCards]);

  const lineRows: LineRow[] = useMemo(() => {
    const rateCardRows = preview.data
      ? selectedCards.map((card) => {
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
        })
      : selectedCards.map((card) => {
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

    const customRows = preview.data
      ? preview.data.lines
          .filter((item) => item.rateCardId === 'custom')
          .map((line) => ({
            rateCardId: 'custom',
            description: line.description,
            unitPricePerThousand: 0,
            makeReadyFixed: 0,
            unitsInThousands: 0,
            lineTotalExVat: line.lineTotalExVat,
            code: 'CUSTOM'
          }))
      : customLines.map((line) => ({
          rateCardId: 'custom',
          description: line.customDescription,
          unitPricePerThousand: 0,
          makeReadyFixed: 0,
          unitsInThousands: 0,
          lineTotalExVat: line.customPrice,
          code: 'CUSTOM'
        }));

    return [...rateCardRows, ...customRows];
  }, [selectedCards, customLines, preview.data, existingQuote]);

  const totals = preview.data?.totals ?? existingQuote?.totals ?? { subtotal: 0, total: 0 };
  const isEditing = Boolean(existingQuote);

  const columns = useMemo<ColumnDef<LineRow>[]>(
    () => [
      {
        accessorKey: 'description',
        header: 'Operation',
        cell: ({ row }) => (
          <p className="font-medium text-slate-900">{row.original.description}</p>
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
            onClick={() => {
              if (row.original.rateCardId === 'custom') {
                const customLine = customLines.find(
                  (line) => line.customDescription === row.original.description
                );
                if (customLine) {
                  removeCustomLine(customLine.id);
                }
              } else {
                setSelectedRateCardIds((current) => current.filter((id) => id !== row.original.rateCardId));
              }
            }}
          >
            Remove
          </Button>
        )
      }
    ],
    [customLines]
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

  const addCustomLine = () => {
    if (!customDescription || !customPrice) {
      toast.error('Please enter both description and price for the custom item.');
      return;
    }
    setCustomLines((current) => [...current, {
      id: Math.random().toString(),
      customDescription,
      customPrice: parseFloat(customPrice)
    }]);
    setCustomDescription('');
    setCustomPrice('');
    setShowCustomForm(false);
  };

  const removeCustomLine = (id: string) => {
    setCustomLines((current) => current.filter((line) => line.id !== id));
  };

  const onSubmit = form.handleSubmit(async (values, event) => {
    if (!selectedRateCardIds.length && !customLines.length) {
      toast.error('Add at least one operation or custom item to build a quote.');
      return;
    }

    try {
      const payload = {
        ...values,
        lines: [
          ...selectedRateCardIds.map((id) => ({ rateCardId: id })),
          ...customLines.map((line) => ({ customDescription: line.customDescription, customPrice: line.customPrice }))
        ]
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
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" type="number" min={1} {...form.register('quantity', { valueAsNumber: true })} />
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
            <div className="space-y-4">
              {/* Data Processing Category */}
              {rateCardsByCategory.DATA_PROCESSING?.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Data Processing</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedCardId}
                      onChange={(event) => setSelectedCardId(event.target.value)}
                      className="flex-1"
                    >
                      <option value="">Select operation</option>
                      {rateCardsByCategory.DATA_PROCESSING.map((card) => (
                        <option key={card.id} value={card.id}>{card.name}</option>
                      ))}
                    </Select>
                    <Button type="button" variant="secondary" onClick={addRateCard} disabled={!selectedCardId}>
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Personalisation Category */}
              {rateCardsByCategory.PERSONALISATION?.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Personalisation</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedCardId}
                      onChange={(event) => setSelectedCardId(event.target.value)}
                      className="flex-1"
                    >
                      <option value="">Select operation</option>
                      {rateCardsByCategory.PERSONALISATION.map((card) => (
                        <option key={card.id} value={card.id}>{card.name}</option>
                      ))}
                    </Select>
                    <Button type="button" variant="secondary" onClick={addRateCard} disabled={!selectedCardId}>
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Finishing Category */}
              {rateCardsByCategory.FINISHING?.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Finishing</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedCardId}
                      onChange={(event) => setSelectedCardId(event.target.value)}
                      className="flex-1"
                    >
                      <option value="">Select operation</option>
                      {rateCardsByCategory.FINISHING.map((card) => (
                        <option key={card.id} value={card.id}>{card.name}</option>
                      ))}
                    </Select>
                    <Button type="button" variant="secondary" onClick={addRateCard} disabled={!selectedCardId}>
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Enclosing Category */}
              {rateCardsByCategory.ENCLOSING?.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Enclosing</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedCardId}
                      onChange={(event) => setSelectedCardId(event.target.value)}
                      className="flex-1"
                    >
                      <option value="">Select operation</option>
                      {rateCardsByCategory.ENCLOSING.map((card) => (
                        <option key={card.id} value={card.id}>{card.name}</option>
                      ))}
                    </Select>
                    <Button type="button" variant="secondary" onClick={addRateCard} disabled={!selectedCardId}>
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Custom Item Button */}
              <div className="pt-2 border-t">
                <Button type="button" variant="ghost" onClick={() => setShowCustomForm(!showCustomForm)}>
                  + Custom item
                </Button>
              </div>
            </div>
            {showCustomForm && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">Add bespoke line item</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customDescription" className="text-xs">Description</Label>
                    <Input
                      id="customDescription"
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder="e.g., Custom die cutting"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customPrice" className="text-xs">Price (£)</Label>
                    <Input
                      id="customPrice"
                      type="number"
                      step="0.01"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="0.00"
                      className="bg-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={addCustomLine} className="text-xs">
                    Add to quote
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowCustomForm(false)} className="text-xs">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
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
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <Label htmlFor="discountPercentage">Discount %</Label>
              <Input
                id="discountPercentage"
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="0"
                {...form.register('discountPercentage', { valueAsNumber: true })}
              />
            </div>
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">{formatGBP(totals.subtotal ?? 0)}</span>
              </div>
              {(totals.discount ?? 0) > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Discount ({totals.discountPercentage ?? 0}%)</span>
                  <span className="font-mono text-red-600">-{formatGBP(totals.discount ?? 0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-lg font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total</span>
                <span className="font-mono">{formatGBP(totals.total ?? 0)}</span>
              </div>
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
