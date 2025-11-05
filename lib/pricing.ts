import Decimal from 'decimal.js';
import type { Band, RateCard } from '@prisma/client';

export type RateCardWithBands = RateCard & { bands: Band[] };

export type QuotePricingInput = {
  quantity: number;
  insertsCount: number;
  vatRate: number;
  rateCards: RateCardWithBands[];
};

export type QuoteLineCalculation = {
  rateCardId: string;
  description: string;
  unitPricePerThousand: Decimal;
  makeReadyFixed: Decimal;
  unitsInThousands: Decimal;
  lineTotalExVat: Decimal;
};

const thousand = new Decimal(1000);

export const selectBand = (rateCard: RateCardWithBands, quantity: number) => {
  return rateCard.bands.find((band) => quantity >= band.fromQty && quantity <= band.toQty) ?? null;
};

export const calculateUnits = (rateCard: RateCardWithBands, quantity: number, insertsCount: number) => {
  const qty = new Decimal(quantity);
  if (rateCard.unit === 'job') {
    return new Decimal(0);
  }

  if (rateCard.unit === 'enclose') {
    // Insert-aware enclosing multiplies base quantity by the number of inserts handled.
    return qty.mul(insertsCount).div(thousand);
  }

  return qty.div(thousand);
};

export const calculateLine = (
  rateCard: RateCardWithBands,
  band: Band,
  quantity: number,
  insertsCount: number
): QuoteLineCalculation => {
  const units = calculateUnits(rateCard, quantity, insertsCount);
  const unitPrice = new Decimal(band.pricePerThousand.toString());
  const makeReady = new Decimal(band.makeReadyFixed.toString());

  // Line total brings together fixed make-ready and throughput cost for the chosen band.
  const lineTotal = makeReady.add(units.mul(unitPrice));

  return {
    rateCardId: rateCard.id,
    description: rateCard.name,
    unitPricePerThousand: unitPrice,
    makeReadyFixed: makeReady,
    unitsInThousands: units,
    lineTotalExVat: lineTotal
  };
};

export const calculateQuoteLines = (
  quantity: number,
  insertsCount: number,
  cards: RateCardWithBands[]
) => {
  return cards.map((rateCard) => {
    const band = selectBand(rateCard, quantity);
    if (!band) {
      throw new Error(`No pricing band found for rate card ${rateCard.code} at quantity ${quantity}`);
    }

    return calculateLine(rateCard, band, quantity, insertsCount);
  });
};

export const calculateTotals = (lines: QuoteLineCalculation[]) => {
  const subtotal = lines.reduce((acc, line) => acc.add(line.lineTotalExVat), new Decimal(0));
  
  // Quotes don't include VAT - subtotal equals total
  return {
    subtotal,
    total: subtotal
  };
};

export const formatGBP = (value: Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return '£0.00';
  }
  const decimalValue = Decimal.isDecimal(value) ? value : new Decimal(value);
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2
  }).format(decimalValue.toNumber());
};
