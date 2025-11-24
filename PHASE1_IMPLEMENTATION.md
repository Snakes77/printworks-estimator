# Phase 1: 7-Category Quote System - Implementation Summary

## ✅ Completed Changes

### 1. Database Schema Updates (`prisma/schema.prisma`)

- ✅ Added `QuoteCategory` enum with 7 categories:
  - `ENVELOPES`
  - `PRINT`
  - `DATA_PROCESSING`
  - `PERSONALISATION`
  - `FINISHING`
  - `ENCLOSING`
  - `POSTAGE`

- ✅ Updated `RateCard` model:
  - Added `category: QuoteCategory?` field

- ✅ Updated `QuoteLine` model:
  - Added `category: QuoteCategory` (required)
  - Added `isManualItem: Boolean` (default: false)
  - Added `manualQuantity: Decimal?` (for envelope wastage)
  - Added `pricePerItem: Decimal?` (for postage with 3 decimals)

- ✅ Updated `Quote` model:
  - Added `baseReference: String` (e.g., "Q00001")
  - Added `revisionNumber: Int` (default: 0)
  - Kept `reference: String` for backward compatibility (computed: baseReference + "-" + revisionNumber)

- ✅ Added `QuoteCounter` model:
  - Singleton table for tracking quote numbering sequence

### 2. Pricing Logic Updates (`lib/pricing.ts`)

- ✅ Updated `QuoteLineCalculation` type to include `category: QuoteCategory`
- ✅ Updated `calculateLine()` to extract category from rate card (defaults to PRINT)
- ✅ Completely rewrote `calculateTotals()`:
  - Now accepts `quantity` parameter (required for P/1000 calculation)
  - Returns `QuoteTotalsWithCategories` with:
    - `categoryTotals`: Breakdown by all 7 categories
    - `pricePerThousand`: Calculated as `(Total ÷ Quantity) × 1000`
  - Maintains backward compatibility with discount logic

### 3. Quote Numbering System (`lib/quote-numbering.ts`)

- ✅ Created `getNextQuoteNumber()` function:
  - Uses `QuoteCounter` singleton to generate sequential numbers
  - Returns format: `Q00001`, `Q00002`, etc.
  - First revision is `-0` (e.g., `Q00001-0`)

### 4. tRPC Router Updates (`server/api/routers/quotes.ts`)

- ✅ Updated `serialiseLine()` to include category and manual item fields
- ✅ Updated `serialiseTotals()` to include:
  - `categoryTotals` object with all 7 categories
  - `pricePerThousand` value
- ✅ Updated all `calculateTotals()` calls to pass `quantity` parameter
- ✅ Updated `preview`, `create`, and `update` mutations:
  - Extract category from rate cards
  - Default custom items to `PRINT` category
  - Store category in quote lines
- ✅ Added automatic quote numbering in `create` mutation:
  - Generates new quote number if reference doesn't match pattern
  - Extracts base reference and revision from existing format

### 5. Migration Scripts

- ✅ Created `prisma/scripts/categorize-rate-cards.ts`:
  - Maps rate card codes to categories
  - Updates all rate cards with their appropriate category
  - **Note**: You'll need to add mappings for all 38 rate cards

- ✅ Created `prisma/scripts/backfill-categories.ts`:
  - Backfills categories for existing quote lines
  - Backfills `baseReference` and `revisionNumber` for existing quotes
  - Handles quotes with non-standard reference formats

## 📋 Next Steps

### Step 1: Run Prisma Migration

```bash
# Generate Prisma Client with new schema
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_category_system
```

**⚠️ Important**: The migration will:
- Add new required fields (`category` on `QuoteLine`, `baseReference` on `Quote`)
- You may need to provide default values or handle existing data

### Step 2: Categorize Rate Cards

1. **Update the mapping** in `prisma/scripts/categorize-rate-cards.ts`:
   - Add all 38 rate card codes with their categories
   - Use the seed file and your actual rate cards as reference

2. **Run the categorization script**:
   ```bash
   npx tsx prisma/scripts/categorize-rate-cards.ts
   ```

3. **Verify** all rate cards have categories:
   ```bash
   npx prisma studio
   # Check RateCard table - all should have category set
   ```

### Step 3: Backfill Existing Data

```bash
# Backfill categories for existing quotes and quote lines
npx tsx prisma/scripts/backfill-categories.ts
```

This will:
- Set categories on all existing quote lines based on their rate card
- Set `baseReference` and `revisionNumber` on existing quotes
- Handle quotes with non-standard reference formats

### Step 4: Test the Implementation

Use the test scenario from your requirements:

```typescript
// Expected test results for Q8078-1 (52,000 quantity):
const testLines = [
  { category: 'ENVELOPES', lineTotalExVat: new Decimal(2939) },
  { category: 'PRINT', lineTotalExVat: new Decimal(0) },
  { category: 'DATA_PROCESSING', lineTotalExVat: new Decimal(125) },
  { category: 'PERSONALISATION', lineTotalExVat: new Decimal(1016) },
  { category: 'FINISHING', lineTotalExVat: new Decimal(160) },
  { category: 'ENCLOSING', lineTotalExVat: new Decimal(788) },
  { category: 'POSTAGE', lineTotalExVat: new Decimal(13468) },
];

const totals = calculateTotals(testLines, 52000, 0);

// Expected:
// totals.subtotal.toNumber() === 18496
// totals.pricePerThousand.toFixed(2) === '355.70'
// totals.categoryTotals.ENVELOPES.toNumber() === 2939
```

### Step 5: Update Frontend Components

The following components will need updates to display categories:

- `components/quotes/quote-builder.tsx` - Display category breakdown
- `components/quotes/quote-view.tsx` - Show category totals
- `components/quotes/quote-pdf.tsx` - PDF format with 7 categories

## 🔍 Rate Card Category Mapping

You need to complete the mapping in `prisma/scripts/categorize-rate-cards.ts`. Based on your seed file, here's a starting point:

```typescript
const RATE_CARD_CATEGORIES: Record<string, QuoteCategory> = {
  // Envelopes
  'ENV-C5': 'ENVELOPES',
  'ENV-C4': 'ENVELOPES',
  'ENV-DL': 'ENVELOPES',
  
  // Data Processing
  'DATA-IN': 'DATA_PROCESSING',
  
  // Personalisation
  'A4-SIMPLEX': 'PERSONALISATION',
  
  // Finishing
  'FOLD-A4-A5': 'FINISHING',
  
  // Enclosing
  'ENCLOSE': 'ENCLOSING',
  
  // Postage
  'POST-C5-STANDARD': 'POSTAGE',
  
  // Add all 38 rate cards here...
};
```

## ⚠️ Migration Considerations

### Existing Quotes

- **Quote Lines**: Will get categories from their rate card (or default to PRINT)
- **Quote References**: Will be parsed to extract `baseReference` and `revisionNumber`
- **Custom Items**: Will default to PRINT category

### Breaking Changes

- `calculateTotals()` now requires `quantity` as second parameter
- All quote lines must have a category (enforced by schema)
- Quote numbering system is now sequential (Q00001, Q00002, etc.)

### Backward Compatibility

- `reference` field is kept for backward compatibility
- Old quotes will continue to work after backfill script
- Frontend can gradually migrate to use `baseReference` and `revisionNumber`

## 📊 Success Criteria Checklist

- [ ] `npx prisma generate` runs without errors
- [ ] `npx prisma migrate dev` creates migration successfully
- [ ] Run categorization script - all 38 rate cards have categories
- [ ] Run backfill script - all existing quotes have categories and numbering
- [ ] Create test quote → `totals.categoryTotals.ENVELOPES` returns Decimal
- [ ] `totals.pricePerThousand` calculates correctly: £18,496 ÷ 52,000 × 1000 = £355.70
- [ ] New quotes get sequential numbering (Q00001, Q00002, etc.)

## 🐛 Troubleshooting

### Migration fails with "column cannot be null"

If the migration fails because `category` or `baseReference` can't be null:
1. Make fields nullable temporarily in schema
2. Run migration
3. Run backfill script
4. Make fields required again
5. Run another migration

### Rate cards missing categories

1. Check `prisma/scripts/categorize-rate-cards.ts` mapping
2. Add missing rate card codes
3. Re-run categorization script

### Quote numbering not working

1. Ensure `QuoteCounter` singleton exists:
   ```sql
   INSERT INTO quote_counter (id, "lastNumber") VALUES ('singleton', 0) ON CONFLICT DO NOTHING;
   ```
2. Check `getNextQuoteNumber()` is being called in create mutation

## 📝 Notes

- Manual items (envelopes with wastage, postage with custom pricing) are supported via `isManualItem`, `manualQuantity`, and `pricePerItem` fields
- Custom line items default to PRINT category (can be changed later)
- Quote numbering starts at Q00001 (can be adjusted in QuoteCounter if needed)
- P/1000 calculation handles zero quantity gracefully (returns 0)

