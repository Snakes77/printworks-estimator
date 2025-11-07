import Decimal from 'decimal.js';
import type { Band, RateCard, QuoteCategory } from '@prisma/client';
import { isFeatureEnabled } from './feature-flags';

export type RateCardWithBands = RateCard & { bands: Band[] };

export type QuotePricingInput = {
  quantity: number;
  vatRate: number;
  rateCards: RateCardWithBands[];
};

// Legacy line calculation (V1) - no category required
export type QuoteLineCalculationV1 = {
  rateCardId: string;
  description: string;
  unitPricePerThousand: Decimal;
  makeReadyFixed: Decimal;
  unitsInThousands: Decimal;
  lineTotalExVat: Decimal;
};

// New line calculation (V2) - with category
export type QuoteLineCalculation = {
  rateCardId: string;
  description: string;
  unitPricePerThousand: Decimal;
  makeReadyFixed: Decimal;
  unitsInThousands: Decimal;
  lineTotalExVat: Decimal;
  category: QuoteCategory; // Required: Every line MUST have a category
};

const thousand = new Decimal(1000);

export const selectBand = (rateCard: RateCardWithBands, quantity: number) => {
  return rateCard.bands.find((band) => quantity >= band.fromQty && quantity <= band.toQty) ?? null;
};

export const calculateUnits = (rateCard: RateCardWithBands, quantity: number) => {
  const qty = new Decimal(quantity);
  if (rateCard.unit === 'job') {
    return new Decimal(0);
  }

  if (rateCard.unit === 'enclose') {
    // For enclose operations, just use quantity (no insert multiplier)
    return qty.div(thousand);
  }

  return qty.div(thousand);
};

export const calculateLine = (
  rateCard: RateCardWithBands,
  band: Band,
  quantity: number
): QuoteLineCalculation => {
  const units = calculateUnits(rateCard, quantity);
  const unitPrice = new Decimal(band.pricePerThousand.toString());
  const makeReady = new Decimal(band.makeReadyFixed.toString());

  // Line total brings together fixed make-ready and throughput cost for the chosen band.
  const lineTotal = makeReady.add(units.mul(unitPrice));

  // Get category from rate card, default to PRINT if not set
  const category = rateCard.category || 'PRINT';

  return {
    rateCardId: rateCard.id,
    description: rateCard.name,
    unitPricePerThousand: unitPrice,
    makeReadyFixed: makeReady,
    unitsInThousands: units,
    lineTotalExVat: lineTotal,
    category
  };
};

export const calculateQuoteLines = (
  quantity: number,
  cards: RateCardWithBands[]
) => {
  return cards.map((rateCard) => {
    const band = selectBand(rateCard, quantity);
    if (!band) {
      throw new Error(`No pricing band found for rate card ${rateCard.code} at quantity ${quantity}`);
    }

    return calculateLine(rateCard, band, quantity);
  });
};

export type CategoryTotals = {
  [K in QuoteCategory]: Decimal;
};

export type QuoteTotalsWithCategories = {
  subtotal: Decimal;
  discount: Decimal;
  discountPercentage: Decimal;
  total: Decimal;
  categoryTotals: CategoryTotals;
  pricePerThousand: Decimal; // P/1000 cost
};

export type QuoteTotalsLegacy = {
  subtotal: Decimal;
  discount: Decimal;
  discountPercentage: Decimal;
  total: Decimal;
};

/**
 * V1: Legacy calculateTotals (no categories, no P/1000)
 * This is the original working function - kept for backwards compatibility.
 */
export const calculateTotalsV1 = (
  lines: QuoteLineCalculationV1[],
  discountPercentage: number = 0
): QuoteTotalsLegacy => {
  const subtotal = lines.reduce((acc, line) => acc.add(line.lineTotalExVat), new Decimal(0));

  // Apply discount if specified
  const discountDecimal = new Decimal(discountPercentage).div(100);
  const discountAmount = subtotal.mul(discountDecimal);
  const total = subtotal.sub(discountAmount);

  return {
    subtotal,
    discount: discountAmount,
    discountPercentage: new Decimal(discountPercentage),
    total
  };
};

/**
 * V2: New calculateTotals with categories and P/1000 calculation
 * This is the new implementation with 7-category breakdown.
 */
export const calculateTotalsV2 = (
  lines: QuoteLineCalculation[],
  quantity: number,
  discountPercentage: number = 0
): QuoteTotalsWithCategories => {
  // Initialize category totals
  const categoryTotals: CategoryTotals = {
    ENVELOPES: new Decimal(0),
    PRINT: new Decimal(0),
    DATA_PROCESSING: new Decimal(0),
    PERSONALISATION: new Decimal(0),
    FINISHING: new Decimal(0),
    ENCLOSING: new Decimal(0),
    POSTAGE: new Decimal(0)
  };

  // Sum lines by category
  lines.forEach(line => {
    if (line.category) {
      categoryTotals[line.category] = categoryTotals[line.category].add(line.lineTotalExVat);
    }
  });

  // Calculate subtotal (sum of all categories)
  const subtotal = Object.values(categoryTotals).reduce(
    (acc, cat) => acc.add(cat),
    new Decimal(0)
  );

  // Apply discount
  const discountDecimal = new Decimal(discountPercentage).div(100);
  const discountAmount = subtotal.mul(discountDecimal);
  const total = subtotal.sub(discountAmount);

  // Calculate P/1000 cost: (Total ÷ Quantity) × 1000
  const pricePerThousand = quantity > 0 
    ? total.div(quantity).mul(1000)
    : new Decimal(0);

  return {
    subtotal,
    discount: discountAmount,
    discountPercentage: new Decimal(discountPercentage),
    total,
    categoryTotals,
    pricePerThousand
  };
};

/**
 * Router function that checks feature flag and calls V1 or V2.
 * 
 * Backwards-compatible signatures:
 * - V1: calculateTotals(lines, discountPercentage)
 * - V2: calculateTotals(lines, quantity, discountPercentage, userId?)
 */

// V1 signature: calculateTotals(lines, discountPercentage?)
export function calculateTotals(
  lines: QuoteLineCalculationV1[],
  discountPercentage?: number
): QuoteTotalsLegacy;

// V2 signature: calculateTotals(lines, quantity, discountPercentage, userId?)
export function calculateTotals(
  lines: QuoteLineCalculation[],
  quantity: number,
  discountPercentage: number,
  userId?: string
): QuoteTotalsWithCategories;

// Implementation
export function calculateTotals(
  lines: QuoteLineCalculationV1[] | QuoteLineCalculation[],
  quantityOrDiscount?: number,
  discountPercentageOrUserId?: number | string,
  userId?: string
): QuoteTotalsLegacy | QuoteTotalsWithCategories {
  // Determine which version to use based on arguments and feature flag
  // V2 signature: calculateTotals(lines, quantity, discountPercentage, userId?)
  // - Has 3+ arguments
  // - Second arg is number (quantity)
  // - Third arg is number (discountPercentage)
  const isV2Signature = arguments.length >= 3 && 
    typeof quantityOrDiscount === 'number' && 
    typeof discountPercentageOrUserId === 'number';
  
  // Get user context for feature flag check
  const context = userId 
    ? { userId } 
    : typeof discountPercentageOrUserId === 'string' 
      ? { userId: discountPercentageOrUserId }
      : {};

  // Check feature flag
  const useV2 = isFeatureEnabled('CATEGORY_SYSTEM', context);

  if (useV2 && isV2Signature) {
    // V2: New system with categories
    const quantity = quantityOrDiscount!;
    const discountPercentage = discountPercentageOrUserId as number;
    
    // Ensure lines have categories (default to PRINT if missing)
    const linesWithCategories: QuoteLineCalculation[] = lines.map(line => {
      if ('category' in line) {
        return line as QuoteLineCalculation;
      }
      // Legacy line without category - default to PRINT
      return {
        ...line,
        category: 'PRINT' as QuoteCategory
      };
    });

    return calculateTotalsV2(linesWithCategories, quantity, discountPercentage);
  } else {
    // V1: Legacy system (no categories)
    // V1 signature: calculateTotals(lines, discountPercentage?)
    const discountPercentage = isV2Signature
      ? (discountPercentageOrUserId as number)
      : (quantityOrDiscount ?? 0);
    
    // Convert lines to V1 format (strip category if present)
    const linesV1: QuoteLineCalculationV1[] = lines.map(line => {
      if ('category' in line) {
        const { category, ...rest } = line as QuoteLineCalculation;
        return rest;
      }
      return line as QuoteLineCalculationV1;
    });

    return calculateTotalsV1(linesV1, discountPercentage);
  }
}

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
