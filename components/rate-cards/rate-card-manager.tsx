'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Save, X } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type RateCard = {
  id: string;
  code: string;
  name: string;
  unit: 'per_1k' | 'job' | 'enclose';
  notes?: string | null;
  bands: {
    id: string;
    fromQty: number;
    toQty: number;
    pricePerThousand: number;
    makeReadyFixed: number;
  }[];
};

type DraftRateCard = {
  id?: string;
  code: string;
  name: string;
  unit: 'per_1k' | 'job' | 'enclose';
  notes?: string | null;
  bands: {
    id?: string;
    fromQty: number;
    toQty: number;
    pricePerThousand: number;
    makeReadyFixed: number;
  }[];
};

const emptyRateCard = (): DraftRateCard => ({
  code: '',
  name: '',
  unit: 'per_1k',
  notes: '',
  bands: [
    { fromQty: 1, toQty: 1000, pricePerThousand: 0, makeReadyFixed: 0 },
    { fromQty: 1001, toQty: 5000, pricePerThousand: 0, makeReadyFixed: 0 }
  ]
});

export const RateCardManager = () => {
  const rateCardsQuery = trpc.rateCards.list.useQuery();
  const createMutation = trpc.rateCards.create.useMutation();
  const updateMutation = trpc.rateCards.update.useMutation();
  const removeMutation = trpc.rateCards.remove.useMutation();
  const utils = trpc.useUtils();

  const [draft, setDraft] = useState<DraftRateCard | null>(null);

  const openEditor = (rateCard?: RateCard) => {
    if (rateCard) {
      setDraft({
        id: rateCard.id,
        code: rateCard.code,
        name: rateCard.name,
        unit: rateCard.unit as 'per_1k' | 'job' | 'enclose',
        notes: rateCard.notes ?? '',
        bands: rateCard.bands.map((band) => ({
          id: band.id,
          fromQty: band.fromQty,
          toQty: band.toQty,
          pricePerThousand: Number(band.pricePerThousand),
          makeReadyFixed: Number(band.makeReadyFixed)
        }))
      });
    } else {
      setDraft(emptyRateCard());
    }
  };

  const closeEditor = () => setDraft(null);

  const submitDraft = async () => {
    if (!draft) return;

    try {
      const payload = { ...draft, notes: draft.notes ?? undefined };
      if (draft.id) {
        await updateMutation.mutateAsync({
          id: draft.id,
          code: draft.code,
          name: draft.name,
          unit: draft.unit,
          notes: draft.notes ?? undefined,
          bands: draft.bands
        });
        toast.success('Rate card updated.');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Rate card created.');
      }

      closeEditor();
      await utils.rateCards.list.invalidate();
    } catch (error) {
      console.error(error);
      toast.error('Unable to save the rate card.');
    }
  };

  const removeDraft = async () => {
    if (!draft?.id) {
      closeEditor();
      return;
    }

    try {
      await removeMutation.mutateAsync({ id: draft.id });
      toast.success('Rate card deleted.');
      closeEditor();
      await utils.rateCards.list.invalidate();
    } catch (error) {
      console.error(error);
      toast.error('Unable to delete the rate card.');
    }
  };

  const updateBand = (index: number, field: keyof DraftRateCard['bands'][number], value: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      bands: draft.bands.map((band, idx) =>
        idx === index
          ? {
              ...band,
              [field]: value
            }
          : band
      )
    });
  };

  const addBand = () => {
    if (!draft) return;
    const lastBand = draft.bands[draft.bands.length - 1];
    setDraft({
      ...draft,
      bands: [
        ...draft.bands,
        {
          fromQty: lastBand ? lastBand.toQty + 1 : 1,
          toQty: (lastBand ? lastBand.toQty : 0) + 1000,
          pricePerThousand: 0,
          makeReadyFixed: 0
        }
      ]
    });
  };

  const removeBand = (index: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      bands: draft.bands.filter((_, idx) => idx !== index)
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || removeMutation.isPending;

  const sortedRateCards = useMemo(() => {
    return (rateCardsQuery.data ?? []).map((card) => ({
      ...card,
      bands: [...card.bands].sort((a, b) => a.fromQty - b.fromQty)
    }));
  }, [rateCardsQuery.data]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <Card className="lg:col-span-1 lg:order-2">
        <CardHeader>
          <CardTitle>{draft ? (draft.id ? 'Edit rate card' : 'Add rate card') : 'Rate card details'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={draft.code}
                  onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                  placeholder="DATA-IN"
                  disabled={Boolean(draft.id)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Data Ingestion"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  id="unit"
                  value={draft.unit}
                  onChange={(event) => setDraft({ ...draft, unit: event.target.value as DraftRateCard['unit'] })}
                >
                  <option value="per_1k">Per 1,000</option>
                  <option value="enclose">Enclose (per insert)</option>
                  <option value="job">Per job</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={draft.notes ?? ''}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  placeholder="Optional guidance"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Quantity Bands</h3>
                  <Button type="button" variant="ghost" className="text-xs text-blue-600 hover:text-blue-700" onClick={addBand}>
                    <Plus className="mr-1 h-4 w-4" /> Add band
                  </Button>
                </div>
                <div className="space-y-3">
                  {draft.bands.map((band, index) => (
                    <div key={band.id ?? index} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">Band {index + 1}</span>
                        {draft.bands.length > 1 && (
                          <Button
                            variant="ghost"
                            className="h-auto p-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeBand(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`from-${index}`} className="text-xs text-slate-600">Quantity from</Label>
                          <Input
                            id={`from-${index}`}
                            type="number"
                            value={band.fromQty}
                            onChange={(event) => updateBand(index, 'fromQty', Number(event.target.value))}
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`to-${index}`} className="text-xs text-slate-600">Quantity to</Label>
                          <Input
                            id={`to-${index}`}
                            type="number"
                            value={band.toQty}
                            onChange={(event) => updateBand(index, 'toQty', Number(event.target.value))}
                            className="bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`price-${index}`} className="text-xs text-slate-600">Price per 1,000</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">£</span>
                            <Input
                              id={`price-${index}`}
                              type="number"
                              value={band.pricePerThousand}
                              step="0.01"
                              onChange={(event) => updateBand(index, 'pricePerThousand', Number(event.target.value))}
                              className="bg-white pl-7"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`makeready-${index}`} className="text-xs text-slate-600">Make-ready</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">£</span>
                            <Input
                              id={`makeready-${index}`}
                              type="number"
                              value={band.makeReadyFixed}
                              step="0.01"
                              onChange={(event) => updateBand(index, 'makeReadyFixed', Number(event.target.value))}
                              className="bg-white pl-7"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" onClick={submitDraft} disabled={isSaving} className="flex-1">
                  <Save className="mr-2 h-4 w-4" /> Save
                </Button>
                <Button type="button" variant="secondary" onClick={removeDraft} disabled={isSaving}>
                  Delete
                </Button>
                <Button type="button" variant="ghost" onClick={closeEditor}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a rate card to edit, or add a new one.</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:order-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rate cards</CardTitle>
          <Button variant="secondary" onClick={() => openEditor()}>
            Add rate card
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[140px]">Unit</TableHead>
                  <TableHead className="w-[100px]">Bands</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRateCards.map((card) => (
                  <TableRow key={card.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openEditor(card as unknown as RateCard)}>
                    <TableCell>
                      <p className="font-medium text-slate-900">{card.name}</p>
                    </TableCell>
                    <TableCell className="text-slate-600 capitalize">
                      {card.unit === 'per_1k' ? 'Per 1,000' : card.unit === 'enclose' ? 'Enclose' : 'Per job'}
                    </TableCell>
                    <TableCell className="text-slate-600">{card.bands.length}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        className="px-3 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditor(card as unknown as RateCard);
                        }}
                      >
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedRateCards.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-900">No rate cards yet</p>
                        <p className="text-xs text-slate-500">Get started by adding your first rate card</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
