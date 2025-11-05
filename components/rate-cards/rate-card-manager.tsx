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
                  <h3 className="text-sm font-semibold text-slate-800">Bands</h3>
                  <Button type="button" variant="ghost" className="text-xs" onClick={addBand}>
                    <Plus className="mr-2 h-4 w-4" /> Add band
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>£/1k</TableHead>
                        <TableHead>Make-ready</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draft.bands.map((band, index) => (
                        <TableRow key={band.id ?? index}>
                          <TableCell>
                            <Input
                              type="number"
                              value={band.fromQty}
                              onChange={(event) => updateBand(index, 'fromQty', Number(event.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={band.toQty}
                              onChange={(event) => updateBand(index, 'toQty', Number(event.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={band.pricePerThousand}
                              step="0.01"
                              onChange={(event) => updateBand(index, 'pricePerThousand', Number(event.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={band.makeReadyFixed}
                              step="0.01"
                              onChange={(event) => updateBand(index, 'makeReadyFixed', Number(event.target.value))}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" className="text-xs text-red-600" onClick={() => removeBand(index)}>
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Bands</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRateCards.map((card) => (
                <TableRow key={card.id} className="cursor-pointer" onClick={() => openEditor(card as unknown as RateCard)}>
                  <TableCell className="font-medium">{card.code}</TableCell>
                  <TableCell>{card.name}</TableCell>
                  <TableCell>{card.unit}</TableCell>
                  <TableCell>{card.bands.length}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      className="px-3 py-1 text-xs"
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
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500">
                    No rate cards yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
