# Google Apps Script Feasibility Assessment
## PrintWorks Estimator - Short-Term Solution Analysis

**Date:** Assessment for short-term fix consideration  
**System:** PrintWorks Estimator (Quote & Rate Card Management)

---

## Executive Summary

**Yes, you could write a functional Google Apps Script solution**, but with significant trade-offs. It would work best as a **temporary bridge** while your Next.js/Supabase system is being deployed or fixed, rather than as a long-term replacement.

**TL;DR:** ✅ **Feasible** for core functionality | ⚠️ **Limited** for advanced features | 🔄 **Good** for interim solution

---

## Legacy Excel Template Analysis

I've reviewed the existing `DMC Encore Branded Quote Template.xls` file. Here's what I found:

### Excel Structure

**File:** `DMC Encore Branded Quote Template.xls`  
**Sheets:** 2 sheets - "Pricing" and "Order Confirmation"  
**Size:** ~324 rows × 33 columns per sheet

### Key Findings

**1. Pricing Sheet Structure:**
- **Header Row** (Row 1): Contains quantity band headers (ID, Minimum, 1, 5, 30, 100)
- **Item Structure** (Row 3+): 
  - Column A: `select` checkbox
  - Column B: `ID` (item ID number)
  - Column C: `Item` (operation name like "Envelopes", "Print")
  - Column D: `Detail` / `Pricing Breakdown`
  - Column E: `quantity`
  - Column F: `price/k` (price per thousand)
  - Column G: `total`
- **Price Bands**: Different pricing columns for different quantity ranges
- **Operations Found**: Envelopes, Print, and more

**2. Calculation Pattern:**
- Uses `price/k` (price per thousand) model
- Quantity-based band selection
- Manual item selection via checkboxes
- Totals calculated per line item

**3. Order Confirmation Sheet:**
- Similar structure to Pricing sheet
- Appears to be for generating finalized quotes
- Includes client information fields

### Mapping to Google Apps Script

The Excel structure is **very similar** to what your Next.js app implements, making Apps Script replication straightforward:

| Excel Feature | Current Next.js | Apps Script Equivalent |
|--------------|-----------------|------------------------|
| Price bands in columns | Database `Band` table | Sheets columns or lookup table |
| Checkbox selection | Multi-select dropdown | Sheet checkboxes or HTML checkboxes |
| `price/k` calculations | `pricePerThousand` field | Same calculation logic |
| Item selection | Rate card dropdown | Sheet dropdown or HTML select |
| Quantity entry | Number input | Sheet cell or HTML input |
| Totals calculation | `calculateTotals()` function | Same JavaScript function |

**Key Insight:** The Excel template is actually **less sophisticated** than your Next.js app:
- Excel: Manual band selection per item
- Next.js: Automatic band selection based on quantity
- **This means Apps Script can actually improve on the Excel workflow!**

---

## What Google Apps Script CAN Do Well

### ✅ Core Calculation Logic (100% Feasible)
The pricing engine logic is **perfectly translatable** to Google Apps Script:

- **Banded pricing selection** - Easy with IF/VLOOKUP formulas or Apps Script functions
- **Insert-aware calculations** - Simple JavaScript: `(quantity × inserts) / 1000`
- **VAT calculations** - Basic math: `subtotal × (vatRate / 100)`
- **Line totals** - `makeReady + (units × pricePerThousand)`
- **Decimal precision** - Apps Script handles this (though Decimal.js is more robust)

**Example Apps Script Function:**
```javascript
function calculateLineTotal(quantity, insertsCount, rateCardCode, bandData) {
  const band = selectBand(quantity, bandData);
  const units = calculateUnits(rateCardCode, quantity, insertsCount);
  const lineTotal = band.makeReadyFixed + (units * band.pricePerThousand);
  return lineTotal;
}

function calculateUnits(rateCardCode, quantity, insertsCount) {
  if (rateCardCode.unit === 'enclose') {
    return (quantity * insertsCount) / 1000;
  } else if (rateCardCode.unit === 'job') {
    return 0;
  }
  return quantity / 1000;
}
```

### ✅ Data Storage in Google Sheets (Very Feasible)
- **Rate Cards Sheet**: Store rate cards with bands in structured tables
- **Quotes Sheet**: Store quote data, line items, totals
- **History Sheet**: Basic audit trail (though less robust than JSON storage)
- **Multiple sheets** for organization (RateCards, Bands, Quotes, QuoteLines, History)

**Structure Example:**
```
Sheet: RateCards
| Code | Name | Unit | Notes |
|------|------|------|-------|
| LIT-001 | Litho Printing | per_1k | |

Sheet: Bands
| RateCardCode | FromQty | ToQty | PricePerThousand | MakeReadyFixed |
|--------------|----------|-------|------------------|----------------|
| LIT-001 | 1 | 10000 | 50 | 30 |
| LIT-001 | 10001 | 50000 | 40 | 25 |

Sheet: Quotes
| QuoteId | ClientName | ProjectName | Reference | Quantity | Envelope | Inserts | VATRate | Subtotal | VAT | Total | CreatedAt |
```

### ✅ User Interface Options (Moderate Feasibility)
**Option 1: Custom Menu in Sheets**
- Add custom menu: "PrintWorks" → "Create Quote", "Manage Rate Cards"
- Dialog boxes for input (limited but functional)
- Update sheet cells directly

**Option 2: HTML Service Web App**
- Create a standalone web app (deployed from Apps Script)
- More sophisticated UI (similar to your React app, but simpler)
- Can be accessed via URL, no Sheet required
- **Best option for better UX**

**Option 3: Form-Based Workflow**
- Use Google Forms + Apps Script processing
- Less flexible but very user-friendly

### ✅ PDF Generation (Limited but Possible)
- **Option A**: Use Apps Script's built-in `DocumentApp` to create Google Docs, then export as PDF
- **Option B**: Use HTML Service to generate formatted HTML, then convert to PDF via Drive API
- **Option C**: Use external API (like html2pdf or similar) via `UrlFetchApp.fetch()`
- **Limitation**: Not as sophisticated as Puppeteer, but functional for basic quotes

### ✅ CSV Import (Easy)
- Read CSV files uploaded to Google Drive
- Parse with `Utilities.parseCsv()`
- Upsert rate cards into Sheets
- Very similar to your existing import logic

---

## What Google Apps Script CANNOT Do Well

### ❌ Advanced Authentication
- **No built-in user auth** like Supabase magic links
- Would need to rely on Google account sharing (workable for small teams)
- No role-based access control (RBAC) without custom implementation
- **Workaround**: Use Google Workspace sharing permissions

### ❌ Robust Audit Trail
- Can store history in a Sheet, but:
  - No JSON payload storage (would need to serialize manually)
  - Harder to query/search
  - Less structured than PostgreSQL
- **Workaround**: Store as JSON strings in cells, but not ideal

### ❌ Concurrent User Handling
- Google Sheets has **concurrent editing limitations**
- Multiple users editing same sheet can cause conflicts
- **Workaround**: Use locks (`LockService`) but adds complexity

### ❌ Performance at Scale
- Apps Script execution limits:
  - **6 minutes** max execution time
  - **20,000 cells** per sheet read/write limit per call
  - Rate limiting on API calls
- Fine for small teams (<10 users), struggles with larger volumes

### ❌ Database Features
- No relational integrity (foreign keys)
- No transactions (can use `LockService` but not ideal)
- Limited querying (VLOOKUP, QUERY functions, but not SQL)
- **Workaround**: Use structured data and careful validation

### ❌ Modern UI/UX
- HTML Service can create decent UIs, but:
  - No React/Next.js ecosystem
  - Limited styling options
  - Harder to maintain
  - No hot reloading during development

---

## Detailed Feature Comparison

| Feature | Next.js/Supabase | Google Apps Script | Feasibility |
|---------|------------------|-------------------|------------|
| **Rate Card Management** | ✅ Full CRUD | ✅ Full CRUD | ✅ 100% |
| **Banded Pricing** | ✅ Automatic | ✅ Automatic | ✅ 100% |
| **Insert-Aware Calculations** | ✅ Built-in | ✅ Built-in | ✅ 100% |
| **Quote Building** | ✅ Interactive UI | ✅ HTML Service UI | ✅ 90% |
| **Live Preview** | ✅ Real-time | ⚠️ Refresh-based | ⚠️ 70% |
| **PDF Generation** | ✅ Puppeteer (professional) | ⚠️ Docs API (basic) | ⚠️ 60% |
| **Audit Trail** | ✅ JSON + timestamps | ⚠️ Sheet rows | ⚠️ 60% |
| **User Authentication** | ✅ Supabase Auth | ⚠️ Google accounts | ⚠️ 50% |
| **CSV Import** | ✅ Full validation | ✅ Basic validation | ✅ 90% |
| **Multi-user Concurrent** | ✅ Database locks | ⚠️ Sheet locks | ⚠️ 60% |
| **Data Backup** | ✅ Supabase backups | ✅ Google Drive | ✅ 100% |
| **Search/Filter** | ✅ SQL queries | ⚠️ QUERY/VLOOKUP | ⚠️ 70% |
| **Mobile Friendly** | ✅ Responsive | ⚠️ Limited | ⚠️ 50% |
| **Deployment** | ⚠️ Vercel setup | ✅ Instant (no deploy) | ✅ 100% |

---

## Recommended Architecture (If Proceeding)

### Google Sheets Structure

**1. RateCards Sheet**
```
| Code | Name | Unit | Notes | CreatedAt | UpdatedAt |
```

**2. Bands Sheet**
```
| RateCardCode | FromQty | ToQty | PricePerThousand | MakeReadyFixed |
```

**3. Quotes Sheet**
```
| QuoteId | ClientName | ProjectName | Reference | Quantity | Envelope | Inserts | VATRate | Subtotal | VAT | Total | CreatedAt | UpdatedAt | PDFUrl |
```

**4. QuoteLines Sheet**
```
| QuoteId | RateCardCode | Description | Units | UnitPrice | MakeReady | LineTotal |
```

**5. QuoteHistory Sheet**
```
| QuoteId | Action | PayloadJSON | CreatedAt | UserEmail |
```

### Apps Script Functions Needed

```javascript
// Core pricing functions
function selectBand(rateCardCode, quantity) { }
function calculateUnits(rateCardCode, quantity, insertsCount) { }
function calculateLineTotal(rateCardCode, quantity, insertsCount) { }
function calculateQuoteTotals(lines, vatRate) { }

// CRUD operations
function createRateCard(code, name, unit, bands) { }
function updateRateCard(code, updates) { }
function createQuote(clientName, projectName, reference, quantity, envelope, inserts, vatRate, rateCardCodes) { }
function updateQuote(quoteId, updates) { }

// PDF generation
function generateQuotePDF(quoteId) { }

// Import
function importRateCardsFromCSV(csvContent) { }
```

### UI Options

**Option A: HTML Service Web App** (Recommended)
- Create `createQuote.html` with form
- Create `manageRateCards.html` for rate card management
- Deploy as web app from Apps Script editor
- Access via URL: `https://script.google.com/macros/s/.../exec`

**Option B: Custom Menu + Dialogs**
- Add menu bar in Sheets
- Use `SpreadsheetApp.getUi()` for dialogs
- Simpler but less polished

---

## Implementation Estimate

### Time Required
- **Basic version (core features)**: 2-3 days
- **Full-featured version (with PDF, audit trail)**: 5-7 days
- **Polished version (good UI, error handling)**: 10-14 days

### Complexity Breakdown
- **Pricing logic**: 4-6 hours (straightforward JavaScript)
- **Sheets structure setup**: 2-3 hours
- **CRUD operations**: 8-12 hours
- **HTML Service UI**: 12-16 hours
- **PDF generation**: 6-8 hours
- **CSV import**: 4-6 hours
- **Testing & debugging**: 8-12 hours

---

## Pros & Cons Summary

### ✅ Pros
1. **Zero infrastructure cost** - No hosting fees
2. **Instant deployment** - No build/deploy process
3. **Familiar environment** - Google Sheets is widely used
4. **Easy collaboration** - Built-in sharing
5. **Version history** - Google Sheets auto-versioning
6. **Offline capability** - Google Sheets can work offline
7. **Fast to build** - No complex setup required
8. **Good for small teams** - <10 users works well

### ❌ Cons
1. **Limited scalability** - Performance issues with large datasets
2. **Concurrent editing issues** - Conflicts with multiple users
3. **Less professional UI** - Not as polished as React app
4. **Harder to maintain** - No TypeScript, limited tooling
5. **No robust audit trail** - Basic history only
6. **PDF limitations** - Not as professional as Puppeteer
7. **Execution limits** - 6-minute timeout, API rate limits
8. **Data migration pain** - Hard to export to proper database later

---

## Recommendation

### ✅ **YES, if:**
- You need a **short-term fix** (< 3 months)
- You have **< 10 users**
- You're comfortable with **basic UI**
- You need **immediate deployment**
- You can accept **PDF quality limitations**

### ❌ **NO, if:**
- You need a **long-term solution**
- You have **> 15 users**
- You need **professional PDFs**
- You need **robust audit trail**
- You want **modern UX**

### 🎯 **Best Use Case:**
**Temporary bridge solution** while:
- Fixing/deploying the Next.js app
- Training users on the new system
- Migrating data from legacy Excel
- Testing workflows before full deployment

---

## Alternative: Hybrid Approach

Consider keeping **both systems**:

1. **Google Apps Script** for:
   - Quick quote creation
   - Rate card editing
   - Basic reporting

2. **Next.js/Supabase** for:
   - Professional PDFs
   - Full audit trail
   - Multi-user workflows
   - Long-term storage

**Sync data** between systems using:
- Apps Script → Supabase API (create quotes)
- Supabase → Sheets export (reporting)

---

## Next Steps (If Proceeding)

1. **Design Sheets structure** - Map out all sheets and columns
2. **Write core pricing functions** - Port from `lib/pricing.ts`
3. **Create HTML Service UI** - Build quote builder interface
4. **Implement CRUD operations** - Rate cards and quotes
5. **Add PDF generation** - Using Docs API or HTML→PDF
6. **Test with sample data** - Use your existing test cases
7. **Deploy as web app** - Share URL with team
8. **Document workflow** - User guide for team

---

## Sample Code Starter

Here's a basic structure to get you started:

```javascript
// apps-script/PrintWorksEstimator.gs

/**
 * Main pricing calculation function
 */
function calculateQuoteLines(quantity, insertsCount, rateCardCodes) {
  const sheets = SpreadsheetApp.getActiveSpreadsheet();
  const rateCardsSheet = sheets.getSheetByName('RateCards');
  const bandsSheet = sheets.getSheetByName('Bands');
  
  const lines = [];
  
  for (const code of rateCardCodes) {
    const rateCard = getRateCard(code);
    const band = selectBand(rateCard, quantity, bandsSheet);
    const units = calculateUnits(rateCard, quantity, insertsCount);
    const lineTotal = band.makeReadyFixed + (units * band.pricePerThousand);
    
    lines.push({
      rateCardCode: code,
      description: rateCard.name,
      units: units,
      unitPrice: band.pricePerThousand,
      makeReady: band.makeReadyFixed,
      lineTotal: lineTotal
    });
  }
  
  return lines;
}

function selectBand(rateCard, quantity, bandsSheet) {
  const bands = getBandsForRateCard(rateCard.code, bandsSheet);
  
  for (const band of bands) {
    if (quantity >= band.fromQty && quantity <= band.toQty) {
      return band;
    }
  }
  
  throw new Error(`No band found for ${rateCard.code} at quantity ${quantity}`);
}

function calculateUnits(rateCard, quantity, insertsCount) {
  if (rateCard.unit === 'enclose') {
    return (quantity * insertsCount) / 1000;
  } else if (rateCard.unit === 'job') {
    return 0;
  }
  return quantity / 1000;
}

function calculateTotals(lines, vatRate) {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;
  
  return { subtotal, vat, total };
}
```

---

## Practical Implementation Guide (Based on Excel Template)

### Recommended Google Sheets Structure

Based on the legacy Excel template analysis, here's the optimal structure:

**Sheet 1: RateCards**
```
| Code | Name | Unit | Notes | CreatedAt |
|------|------|------|-------|-----------|
| ENV-001 | Envelopes | per_1k | | |
| PRT-001 | Print | per_1k | | |
```

**Sheet 2: Bands**
```
| RateCardCode | FromQty | ToQty | PricePerThousand | MakeReadyFixed |
|--------------|---------|-------|------------------|----------------|
| ENV-001 | 1 | 1000 | 22.90 | 0 |
| ENV-001 | 1001 | 5000 | 34.45 | 0 |
| PRT-001 | 1 | 10000 | 60.00 | 0 |
```

**Sheet 3: Quotes**
```
| QuoteId | ClientName | ProjectName | Reference | Quantity | Envelope | Inserts | VATRate | Subtotal | VAT | Total | CreatedAt | UpdatedAt |
```

**Sheet 4: QuoteLines**
```
| QuoteId | RateCardCode | Description | Units | UnitPrice | MakeReady | LineTotal |
```

**Sheet 5: QuoteHistory**
```
| QuoteId | Action | PayloadJSON | CreatedAt | UserEmail |
```

### Migration Path from Excel

**Step 1: Extract Rate Cards from Excel**
- Parse the "Pricing" sheet to extract items (Envelopes, Print, etc.)
- Extract price bands from columns (Minimum, 1, 5, 30, 100)
- Map to RateCards and Bands sheets

**Step 2: Build Quote Builder UI**
- Create HTML Service form similar to Excel layout
- Use dropdowns for rate card selection (better than Excel checkboxes)
- Auto-calculate bands based on quantity (improvement over Excel!)

**Step 3: Replicate Calculations**
- Port your `lib/pricing.ts` functions directly to Apps Script
- Test against Excel calculations to ensure parity

**Step 4: Generate PDF**
- Use HTML Service to create formatted quote
- Export via Drive API or DocumentApp

### Advantages Over Excel Template

A Google Apps Script solution would actually **improve** on the Excel template:

1. ✅ **Automatic band selection** - No manual band picking per item
2. ✅ **Better data organization** - Normalized tables vs wide columns
3. ✅ **Version control** - Google Sheets revision history
4. ✅ **Multi-user access** - Better than Excel sharing
5. ✅ **Automated calculations** - No formula errors
6. ✅ **Searchable** - Easy to find quotes
7. ✅ **No Excel license needed** - Accessible via browser

### Disadvantages vs Excel

1. ❌ **Less familiar** - Users know Excel better
2. ❌ **Less portable** - Requires Google account
3. ❌ **PDF quality** - Not as polished as Excel → PDF export
4. ❌ **Offline limitations** - Requires internet connection

---

## Conclusion

**Yes, you can write a good Google Apps Script for PrintWorks**, and it would actually **improve** on the legacy Excel template in several ways!

### Strengths:
- ✅ **Better than Excel** - Automatic calculations, better structure
- ✅ **Familiar environment** - Google Sheets is widely used
- ✅ **Quick to build** - Can replicate Excel functionality in days
- ✅ **Zero infrastructure** - No hosting costs
- ✅ **Easy migration** - Can extract data from Excel template

### Limitations:
- ⚠️ **Still a compromise** - Not as robust as Next.js/Supabase
- ⚠️ **Performance limits** - 6-minute execution timeout
- ⚠️ **Concurrent editing** - Can conflict with multiple users
- ⚠️ **PDF quality** - Less professional than Puppeteer

### Final Recommendation:

**Build the Apps Script solution IF:**
1. You need something **immediately** (1-2 weeks)
2. Users are **comfortable with Google Sheets**
3. You have **< 10 users**
4. You can accept **basic PDF quality**
5. This is a **short-term solution** (< 6 months)

**Skip Apps Script and fix Next.js IF:**
1. You need a **long-term solution**
2. You need **professional PDFs**
3. You have **> 15 users**
4. You need **robust audit trails**
5. You want **modern UX**

**Best Approach:** Build Apps Script as a **temporary bridge**, then migrate to Next.js once it's deployed. The Apps Script can help validate workflows and train users before full cutover.

---

**Questions?** Consider:
- What's your timeline?
- How many users?
- What's the main blocker with the Next.js app?
- Can you deploy the Next.js app with temporary workarounds?

Based on your answers, I can provide more specific guidance on whether Apps Script is the right choice or if focusing on the Next.js deployment would be better.

