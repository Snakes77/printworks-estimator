import Decimal from 'decimal.js';
import { describe, expect, it } from '@jest/globals';
import {
  calculateLine,
  calculateTotals,
  calculateUnits,
  selectBand,
  formatGBP,
  type RateCardWithBands
} from '@/lib/pricing';

const buildRateCard = (overrides?: Partial<RateCardWithBands>): RateCardWithBands => ({
  id: 'rc-test',
  code: 'TEST',
  name: 'Test Operation',
  unit: 'per_1k',
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  bands: [
    {
      id: 'band-low',
      rateCardId: 'rc-test',
      fromQty: 1,
      toQty: 10000,
      pricePerThousand: new Decimal(50) as any,
      makeReadyFixed: new Decimal(30) as any
    },
    {
      id: 'band-high',
      rateCardId: 'rc-test',
      fromQty: 10001,
      toQty: 50000,
      pricePerThousand: new Decimal(40) as any,
      makeReadyFixed: new Decimal(25) as any
    }
  ],
  ...overrides
});

describe('Pricing Engine', () => {
  describe('Band Selection', () => {
    it('selects correct band for quantity in middle of range', () => {
      const rateCard = buildRateCard();
      const band = selectBand(rateCard, 5000);

      expect(band?.id).toBe('band-low');
      expect(band?.fromQty).toBe(1);
      expect(band?.toQty).toBe(10000);
    });

    it('selects correct band at exact lower boundary (10000)', () => {
      const rateCard = buildRateCard();
      const band = selectBand(rateCard, 10000);

      expect(band?.id).toBe('band-low');
      expect(Number(band?.pricePerThousand)).toBe(50);
    });

    it('selects next band at boundary + 1 (10001)', () => {
      const rateCard = buildRateCard();
      const band = selectBand(rateCard, 10001);

      expect(band?.id).toBe('band-high');
      expect(Number(band?.pricePerThousand)).toBe(40);
    });

    it('selects correct band at exact upper boundary (50000)', () => {
      const rateCard = buildRateCard();
      const band = selectBand(rateCard, 50000);

      expect(band?.id).toBe('band-high');
    });

    it('returns null when quantity is below all bands', () => {
      const rateCard = buildRateCard({
        bands: [{
          id: 'band-1',
          rateCardId: 'rc-test',
          fromQty: 100,
          toQty: 1000,
          pricePerThousand: new Decimal(50) as any,
          makeReadyFixed: new Decimal(30) as any
        }]
      });

      const band = selectBand(rateCard, 50);
      expect(band).toBeNull();
    });

    it('returns null when quantity is above all bands', () => {
      const rateCard = buildRateCard();
      const band = selectBand(rateCard, 60000);

      expect(band).toBeNull();
    });
  });

  describe('Unit Calculations', () => {
    it('calculates standard per_1k units correctly', () => {
      const rateCard = buildRateCard({ unit: 'per_1k' });
      const units = calculateUnits(rateCard, 20000, 1);

      expect(units.toNumber()).toBe(20);
    });

    it('calculates insert-aware enclosing units (quantity × inserts / 1000)', () => {
      const rateCard = buildRateCard({ unit: 'enclose' });
      const units = calculateUnits(rateCard, 20000, 3);

      // 20,000 envelopes × 3 inserts = 60,000 operations ÷ 1000 = 60 units
      expect(units.toNumber()).toBe(60);
    });

    it('calculates insert-aware with single insert', () => {
      const rateCard = buildRateCard({ unit: 'enclose' });
      const units = calculateUnits(rateCard, 20000, 1);

      expect(units.toNumber()).toBe(20);
    });

    it('calculates insert-aware with large insert count', () => {
      const rateCard = buildRateCard({ unit: 'enclose' });
      const units = calculateUnits(rateCard, 15000, 5);

      // 15,000 × 5 = 75,000 ÷ 1000 = 75
      expect(units.toNumber()).toBe(75);
    });

    it('returns zero units for job-priced lines', () => {
      const rateCard = buildRateCard({ unit: 'job' });
      const units = calculateUnits(rateCard, 50000, 3);

      expect(units.toNumber()).toBe(0);
    });

    it('handles decimal precision for odd quantities', () => {
      const rateCard = buildRateCard({ unit: 'per_1k' });
      const units = calculateUnits(rateCard, 12345, 1);

      expect(units.toNumber()).toBe(12.345);
    });
  });

  describe('Line Total Calculations', () => {
    it('calculates line total = make-ready + (units × price/1k)', () => {
      const rateCard = buildRateCard();
      const band = rateCard.bands[0];
      const line = calculateLine(rateCard, band as any, 20000, 1);

      // 20 units × £50/1k = £1000, + £30 make-ready = £1030
      expect(line.unitsInThousands.toNumber()).toBe(20);
      expect(line.unitPricePerThousand.toNumber()).toBe(50);
      expect(line.makeReadyFixed.toNumber()).toBe(30);
      expect(line.lineTotalExVat.toNumber()).toBe(1030);
    });

    it('calculates job line with zero units (make-ready only)', () => {
      const rateCard = buildRateCard({ unit: 'job' });
      const band = {
        ...rateCard.bands[0],
        pricePerThousand: new Decimal(100) as any,
        makeReadyFixed: new Decimal(250) as any
      };
      const line = calculateLine(rateCard, band as any, 50000, 1);

      // 0 units × £100/1k = £0, + £250 make-ready = £250
      expect(line.unitsInThousands.toNumber()).toBe(0);
      expect(line.lineTotalExVat.toNumber()).toBe(250);
    });

    it('calculates insert-aware enclosing line correctly', () => {
      const rateCard = buildRateCard({ unit: 'enclose', name: 'Enclosing' });
      const band = {
        ...rateCard.bands[0],
        pricePerThousand: new Decimal(25) as any,
        makeReadyFixed: new Decimal(50) as any
      };
      const line = calculateLine(rateCard, band as any, 20000, 3);

      // 60 units × £25/1k = £1500, + £50 make-ready = £1550
      expect(line.unitsInThousands.toNumber()).toBe(60);
      expect(line.lineTotalExVat.toNumber()).toBe(1550);
    });

    it('preserves decimal precision in calculations', () => {
      const rateCard = buildRateCard();
      const band = {
        ...rateCard.bands[0],
        pricePerThousand: new Decimal(33.33) as any,
        makeReadyFixed: new Decimal(27.50) as any
      };
      const line = calculateLine(rateCard, band as any, 15000, 1);

      // 15 units × £33.33/1k = £499.95, + £27.50 = £527.45
      expect(line.lineTotalExVat.toNumber()).toBeCloseTo(527.45, 2);
    });
  });

  describe('VAT and Quote Totals', () => {
    it('calculates 20% VAT correctly', () => {
      const lines = [
        {
          rateCardId: 'rc-1',
          description: 'Line A',
          unitPricePerThousand: new Decimal(50),
          makeReadyFixed: new Decimal(30),
          unitsInThousands: new Decimal(10),
          lineTotalExVat: new Decimal(530)
        },
        {
          rateCardId: 'rc-2',
          description: 'Line B',
          unitPricePerThousand: new Decimal(40),
          makeReadyFixed: new Decimal(20),
          unitsInThousands: new Decimal(5),
          lineTotalExVat: new Decimal(220)
        }
      ];

      const totals = calculateTotals(lines, 20);

      expect(totals.subtotal.toNumber()).toBe(750);
      expect(totals.vat.toNumber()).toBe(150);
      expect(totals.total.toNumber()).toBe(900);
    });

    it('calculates 0% VAT (zero-rated) correctly', () => {
      const lines = [
        {
          rateCardId: 'rc-1',
          description: 'Line A',
          unitPricePerThousand: new Decimal(50),
          makeReadyFixed: new Decimal(30),
          unitsInThousands: new Decimal(20),
          lineTotalExVat: new Decimal(1030)
        }
      ];

      const totals = calculateTotals(lines, 0);

      expect(totals.subtotal.toNumber()).toBe(1030);
      expect(totals.vat.toNumber()).toBe(0);
      expect(totals.total.toNumber()).toBe(1030);
    });

    it('handles empty line array', () => {
      const totals = calculateTotals([], 20);

      expect(totals.subtotal.toNumber()).toBe(0);
      expect(totals.vat.toNumber()).toBe(0);
      expect(totals.total.toNumber()).toBe(0);
    });

    it('calculates subtotal from multiple lines', () => {
      const lines = [
        {
          rateCardId: 'rc-1',
          description: 'Litho',
          unitPricePerThousand: new Decimal(50),
          makeReadyFixed: new Decimal(30),
          unitsInThousands: new Decimal(20),
          lineTotalExVat: new Decimal(1030)
        },
        {
          rateCardId: 'rc-2',
          description: 'Folding',
          unitPricePerThousand: new Decimal(15),
          makeReadyFixed: new Decimal(20),
          unitsInThousands: new Decimal(60),
          lineTotalExVat: new Decimal(920)
        },
        {
          rateCardId: 'rc-3',
          description: 'Enclosing',
          unitPricePerThousand: new Decimal(25),
          makeReadyFixed: new Decimal(50),
          unitsInThousands: new Decimal(60),
          lineTotalExVat: new Decimal(1550)
        }
      ];

      const totals = calculateTotals(lines, 20);

      expect(totals.subtotal.toNumber()).toBe(3500);
      expect(totals.vat.toNumber()).toBe(700);
      expect(totals.total.toNumber()).toBe(4200);
    });
  });

  describe('Currency Formatting', () => {
    it('formats whole pounds with £ symbol', () => {
      expect(formatGBP(100)).toBe('£100.00');
    });

    it('formats pence correctly', () => {
      expect(formatGBP(123.45)).toBe('£123.45');
    });

    it('formats zero correctly', () => {
      expect(formatGBP(0)).toBe('£0.00');
    });

    it('formats Decimal values', () => {
      const value = new Decimal(1234.56);
      expect(formatGBP(value)).toBe('£1,234.56');
    });

    it('formats large values with comma separators', () => {
      expect(formatGBP(12345.67)).toBe('£12,345.67');
    });

    it('always shows two decimal places', () => {
      expect(formatGBP(99)).toBe('£99.00');
      expect(formatGBP(99.9)).toBe('£99.90');
    });

    it('rounds to two decimal places if necessary', () => {
      expect(formatGBP(123.456)).toBe('£123.46');
    });
  });

  describe('Golden Tests - Known Quote Scenarios', () => {
    it('ABC Corp example: 20k mailpieces, C5, 3 inserts, 20% VAT', () => {
      // Litho Printing: per_1k
      const litho = buildRateCard({
        name: 'Litho Printing',
        unit: 'per_1k',
        bands: [{
          id: 'litho-band',
          rateCardId: 'litho',
          fromQty: 1,
          toQty: 50000,
          pricePerThousand: new Decimal(50) as any,
          makeReadyFixed: new Decimal(30) as any
        }]
      });

      // Folding: per_1k (but will be multiplied by inserts in real workflow)
      const folding = buildRateCard({
        name: 'Folding',
        unit: 'enclose',
        bands: [{
          id: 'fold-band',
          rateCardId: 'fold',
          fromQty: 1,
          toQty: 100000,
          pricePerThousand: new Decimal(15) as any,
          makeReadyFixed: new Decimal(20) as any
        }]
      });

      // Enclosing: insert-aware
      const enclosing = buildRateCard({
        name: 'Enclosing',
        unit: 'enclose',
        bands: [{
          id: 'enc-band',
          rateCardId: 'enc',
          fromQty: 1,
          toQty: 100000,
          pricePerThousand: new Decimal(25) as any,
          makeReadyFixed: new Decimal(50) as any
        }]
      });

      const lithoLine = calculateLine(litho, litho.bands[0] as any, 20000, 3);
      const foldLine = calculateLine(folding, folding.bands[0] as any, 20000, 3);
      const encLine = calculateLine(enclosing, enclosing.bands[0] as any, 20000, 3);

      const lines = [lithoLine, foldLine, encLine];
      const totals = calculateTotals(lines, 20);

      // Expected:
      // Litho: 20 units × £50 + £30 = £1,030
      // Folding: 60 units × £15 + £20 = £920
      // Enclosing: 60 units × £25 + £50 = £1,550
      // Subtotal: £3,500
      // VAT (20%): £700
      // Total: £4,200

      expect(lithoLine.lineTotalExVat.toNumber()).toBe(1030);
      expect(foldLine.lineTotalExVat.toNumber()).toBe(920);
      expect(encLine.lineTotalExVat.toNumber()).toBe(1550);
      expect(totals.subtotal.toNumber()).toBe(3500);
      expect(totals.vat.toNumber()).toBe(700);
      expect(totals.total.toNumber()).toBe(4200);
    });

    it('Small job example: 5k, 1 insert, 0% VAT', () => {
      const litho = buildRateCard({
        unit: 'per_1k',
        bands: [{
          id: 'band',
          rateCardId: 'rc',
          fromQty: 1,
          toQty: 10000,
          pricePerThousand: new Decimal(60) as any,
          makeReadyFixed: new Decimal(35) as any
        }]
      });

      const line = calculateLine(litho, litho.bands[0] as any, 5000, 1);
      const totals = calculateTotals([line], 0);

      // 5 units × £60 + £35 = £335
      expect(line.lineTotalExVat.toNumber()).toBe(335);
      expect(totals.total.toNumber()).toBe(335);
    });
  });
});
