# System Upgrade Requirements Summary

Based on client PDFs (Q09928 and Q8078-1) and requirements document.

---

## 1. QUOTE CATEGORY SYSTEM

### Current State:
- Flat list of operations without categorization
- All items treated equally
- No grouping or subtotals by category

### Required Changes:
Implement 7-category system with specific ordering:

1. **Envelopes** (manual input items)
2. **Printed Items** (manual input items)
3. **Data Processing**
4. **Personalisation**
5. **Finishing**
6. **Enclosing**
7. **Postage/Delivery** (manual input - special format)

### Implementation Requirements:
- Add `category` field to RateCard model (enum with 7 values)
- Update all existing rate cards with correct category
- Group operations by category in quote builder dropdown
- Calculate subtotals per category
- Display category subtotals on quote summary
- Maintain category order in all displays

---

## 2. MANUAL INPUT ITEMS

### Current State:
- Only custom/bespoke items with description + total price
- No category assignment for custom items

### Required Changes:
Three categories need manual input capability:

#### **Envelopes:**
- Fields: Description, Quantity, Price/1000, Total
- Example: "C5, 150gsm, printed 2/0, 1 version" - 53,000 @ £55.46/k = £2,939

#### **Printed Items:**
- Fields: Description, Quantity, Price/1000, Total
- May be £0 if not applicable

#### **Postage/Delivery:**
- Special format: Price per unit (in pence) + Total
- Fields: Description, Quantity, Pence per item, Total
- Example: "DSA Admail Mailmark, letter under 100g" - 52,000 @ £0.259 = £13,468
- Must show as "25.9p per item" on summary

### Implementation Requirements:
- Create separate manual input forms for each category
- Store as special line items with category flag
- Calculate totals based on qty × price/1000 (or qty × pence for postage)
- Validate that manual items go into correct categories

---

## 3. QUOTE DISPLAY FORMAT

### Current State:
- Single detail view showing all lines in table
- Basic totals at bottom
- No category grouping in display

### Required Changes:

#### **Summary Page (Page 1):**
```
Pricing totals
1  Envelopes                    £2,939
2  Print                        £0
3  Data Processing              £125
4  Personalisation              £1,016
5  Finishing                    £160
6  Enclosing                    £788
7  Postage/Delivery             £13,468
   Total Price                  £18,496

   P/1000 cost                  £355.70
```

#### **Detail Page (Page 2):**
Show each category with:
- Category header (numbered)
- Line items under category showing:
  - Description
  - Quantity
  - Price/1000
  - Total
- Category subtotal
- For Postage: show pence per item instead of price/1000

### Implementation Requirements:
- Redesign quote view component with category sections
- Calculate P/1000 cost (Total ÷ Quantity × 1000)
- Update PDF template to match exact format
- Group lines by category in display
- Show category subtotals

---

## 4. QUOTE NUMBERING & VERSIONING

### Current State:
- Random CUID as quote reference
- No versioning system
- Cannot track quote revisions

### Required Changes:

#### **Quote Reference Format:**
- Initial quote: `Q0000` (sequential number)
- Revised quote: `Q0000-0` (base + revision suffix)
- Further revisions: `Q0000-1`, `Q0000-2`, etc.

#### **Implementation:**
- Add `baseReference` field (e.g., "Q0000")
- Add `revisionNumber` field (integer, default 0)
- Display reference as: `baseReference` + (revisionNumber > 0 ? `-${revisionNumber}` : '')
- Create "Revise Quote" action that:
  - Copies existing quote
  - Keeps same baseReference
  - Increments revisionNumber
  - Creates new quote ID

#### **Counter Management:**
- Store last used quote number in database
- Auto-increment on new quote creation
- Format with leading zeros (Q0001, Q0023, Q1234)

---

## 5. USER TRACKING & AUDIT

### Current State:
- Quotes track creator (userId)
- No edit tracking
- History shows actions but not who performed them

### Required Changes:

#### **Quote Metadata:**
- Track: Created by, Created date, Last edited by, Last edited date
- Show on quote view: "Created by [Name] on [Date]"
- Show on quote list: "Last edited by [Name]"

#### **History Enhancement:**
- Add `userId` to QuoteHistory entries
- Display user name with each history action
- Example: "Quote updated by John Smith - changed quantity from 10,000 to 20,000"

### Implementation Requirements:
- Add `lastEditedBy` field to Quote model
- Add `lastEditedAt` field (use existing updatedAt)
- Add `userId` field to QuoteHistory model
- Update all mutations to record user
- Display user names in history and metadata

---

## 6. EMAIL CONFIGURATION

### Current State:
- Emails sent from generic address
- No DMC branding in sender

### Required Changes:

#### **Sender Email:**
- Change from: current address
- Change to: `estimating@[client-domain].com`
- Update RESEND_FROM_EMAIL in environment

#### **Email Content:**
- Subject: "Quote Q0000-0: [Project Name] - [Client Name]"
- Body should reference quote number prominently
- Include link to view quote online

### Implementation Requirements:
- Update .env and .env.example with new sender email
- Update email templates in lib/email.ts
- Test email delivery with new sender

---

## 7. QUOTE LIST ENHANCEMENTS

### Current State:
- Basic list with client, reference, quantity, total, date
- Edit button on each row
- No bulk actions or advanced filtering

### Required Changes:

#### **List Display:**
- Show: Reference (Q0000-0), Client, Project, Quantity, Total, Status, Last Edited By, Updated Date
- Remove: Envelope, Inserts columns (already done)
- Sort by: Reference (newest first), Client name, Updated date

#### **List Actions:**
- View Quote
- Edit Quote
- Duplicate Quote
- Revise Quote (creates new version)
- Delete Quote (with confirmation)

#### **Filtering:**
- By status (Draft, Sent, Won, Lost)
- By date range
- By client name
- By user (created by / edited by)

### Implementation Requirements:
- Update QuotesTable component with new columns
- Add "Revise" action button
- Implement duplicate functionality
- Add filtering UI above table

---

## 8. PDF QUOTE GENERATION

### Current State:
- Basic PDF with line items
- No category grouping
- Simple format

### Required Changes:

#### **Page 1 - Summary:**
- Company header with logo
- Client details block (right side)
- Project, Quantity, Reference, Date
- Pricing totals table (7 categories + total + P/1000 cost)
- Notes section (11 standard notes as shown in PDFs)

#### **Page 2 - Detail:**
- Same header
- "Item Pricing Breakdown" heading
- Each category section:
  - Category number + name
  - Line items with columns: Description | Quantity | Price/k | Total
  - Category subtotal
- Special handling for Postage (show pence per item)

#### **Footer:**
- Company name + "Confidential"
- Date
- Page number

### Implementation Requirements:
- Complete redesign of PDF template (app/quotes/[id]/print/page.tsx)
- Match exact styling from client PDFs
- Add notes section with configurable notes
- Implement category grouping in PDF layout
- Test PDF generation with various scenarios

---

## 9. RATE CARD CATEGORIZATION

### Current State:
- 38 rate cards imported from Excel
- No category assignment
- All shown in single dropdown

### Required Changes:

#### **Rate Card Updates:**
Each rate card needs category assignment:

**Data Processing:**
- Receive 1 file, standard job set up...
- Receive and proof additional data files...

**Personalisation:**
- Machine set up (inkjet)
- Machine Set up (laser)
- Laser A4 simplex/duplex
- Inkjet A5/DL/C6 Mailer/Brochure

**Finishing:**
- Fold A4 to A5/DL
- Fold A3 to A5/DL
- Roll fold extended A4...

**Enclosing:**
- Enclose 1-3 standard items...
- Enclose 4-5 standard items...
- Enclose 6-8 items...
- Additional charges for C4/large letter
- Machine matching charges

**Special:**
- Polywrap operations (might be Finishing or separate)

### Implementation Requirements:
- Add category field to schema: `category: QuoteCategory?`
- Create QuoteCategory enum
- Update existing rate cards with categories
- Create categorization script
- Update quote builder to group by category in dropdown

---

## 10. QUOTE BUILDER UI REDESIGN

### Current State:
- Single "Operations" section
- Flat dropdown of all operations
- Custom items separate

### Required Changes:

#### **Layout:**
```
Quote Details Card:
- Client, Project, Reference, Quantity

Category Sections (expandable/collapsible):

1. Envelopes
   [+ Add Manual Envelope Item]
   - Table of added envelope items

2. Printed Items
   [+ Add Manual Print Item]
   - Table of added print items

3. Data Processing
   [Select operation dropdown - filtered to Data Processing only]
   [+ Add operation]
   - Table of added operations

4. Personalisation
   [Select operation dropdown - filtered to Personalisation only]
   [+ Add operation]
   - Table of added operations

5. Finishing
   [Select operation dropdown - filtered to Finishing only]
   [+ Add operation]
   - Table of added operations

6. Enclosing
   [Select operation dropdown - filtered to Enclosing only]
   [+ Add operation]
   - Table of added operations

7. Postage/Delivery
   [+ Add Manual Postage Item]
   - Table of added postage items
   - Show as pence per item

Totals Card:
- Category subtotals
- Discount
- Total
- P/1000 cost
```

### Implementation Requirements:
- Complete redesign of quote-builder.tsx
- Create separate components for each category section
- Implement manual input forms
- Filter operations by category
- Calculate and display category subtotals
- Update totals calculation to show P/1000

---

## 11. DATABASE SCHEMA CHANGES

### New Fields Required:

#### **Quote Model:**
```prisma
model Quote {
  // ... existing fields ...
  baseReference      String   // "Q0000"
  revisionNumber     Int      @default(0)
  lastEditedBy       String?
  // Remove: envelopeType, insertsCount (already done)
}
```

#### **RateCard Model:**
```prisma
model RateCard {
  // ... existing fields ...
  category           QuoteCategory?
}

enum QuoteCategory {
  ENVELOPES
  PRINT
  DATA_PROCESSING
  PERSONALISATION
  FINISHING
  ENCLOSING
  POSTAGE
}
```

#### **QuoteLine Model:**
```prisma
model QuoteLine {
  // ... existing fields ...
  category           String?  // For manual items
  isManualItem       Boolean  @default(false)
  pricePerUnit       Decimal? // For postage (pence)
}
```

#### **QuoteHistory Model:**
```prisma
model QuoteHistory {
  // ... existing fields ...
  userId             String
  user               User     @relation(fields: [userId], references: [id])
}
```

#### **QuoteCounter Model (new):**
```prisma
model QuoteCounter {
  id                 String   @id @default("singleton")
  lastNumber         Int      @default(0)
  updatedAt          DateTime @updatedAt
}
```

---

## 12. PRICING CALCULATIONS

### Current State:
- Simple: (Units/1000 × Price/1000) + Make-ready = Line Total
- Sum all lines for quote total
- Optional discount

### Required Changes:

#### **Category Subtotals:**
- Group lines by category
- Sum within each category
- Display 7 category subtotals

#### **P/1000 Cost:**
- Formula: `(Total Price ÷ Quantity) × 1000`
- Example: £18,496 ÷ 52,000 × 1000 = £355.70
- Display on summary page

#### **Postage Handling:**
- Input: pence per item
- Calculate: quantity × (pence ÷ 100) = total in pounds
- Display: "25.9p per item - Total £13,468"

### Implementation Requirements:
- Update calculateTotals() to return category breakdown
- Add calculatePricePerThousand() helper
- Handle postage special case in calculations
- Update all display components to show new calculations

---

## 13. PRIORITY ORDER OF IMPLEMENTATION

### Phase 1: Foundation (Week 1)
1. Database schema updates (categories, versioning, user tracking)
2. Rate card categorization
3. Quote numbering system
4. Remove envelope/inserts fields (DONE)

### Phase 2: Quote Builder (Week 2)
5. Category-based quote builder UI
6. Manual input forms (Envelopes, Print, Postage)
7. Category filtering in operation dropdowns
8. Category subtotals in totals card

### Phase 3: Display & PDF (Week 3)
9. Quote view redesign with category sections
10. PDF template redesign (summary + detail pages)
11. P/1000 cost calculations
12. Postage pence-per-item display

### Phase 4: Features (Week 4)
13. Quote versioning (Revise function)
14. User tracking in history
15. Enhanced quote list with filters
16. Email configuration update

---

## 14. TESTING REQUIREMENTS

### Test Scenarios:
1. Create quote with all 7 categories populated
2. Create quote with only some categories (e.g., no Print)
3. Add manual envelope items
4. Add manual postage with pence calculation
5. Generate PDF and verify format matches client examples
6. Create revised quote (Q0000-0)
7. Test user tracking in history
8. Test category subtotals accuracy
9. Test P/1000 cost calculation
10. Test postage pence per item display

### Data Migration:
- Existing quotes need category assignment for their lines
- Existing quotes need baseReference and revisionNumber
- Manual categorization of existing rate cards
- Test with real client data from PDFs

---

## 15. POTENTIAL CHALLENGES

### Technical:
- PDF layout complexity (matching exact format)
- Category assignment for existing data
- Quote numbering sequence management
- Postage pence vs pounds calculations

### UX:
- Making category sections intuitive
- Balancing detail with simplicity
- Mobile responsiveness with new layout

### Data:
- Categorizing 38 rate cards correctly
- Migrating existing quotes to new structure
- Handling quotes mid-creation during deployment

---

## 16. ESTIMATED EFFORT

- **Database Changes:** 4-6 hours
- **Rate Card Categorization:** 2-3 hours
- **Quote Builder Redesign:** 12-16 hours
- **Quote Display Updates:** 8-10 hours
- **PDF Template Redesign:** 10-12 hours
- **Quote Versioning:** 4-6 hours
- **User Tracking:** 3-4 hours
- **List Enhancements:** 4-6 hours
- **Testing & Bug Fixes:** 8-10 hours

**Total Estimated:** 55-73 hours (7-9 working days)

---

## 17. QUESTIONS FOR CLIENT

1. Should postage always be in pence, or sometimes in pounds?
2. Can Print category be £0 on quotes, or must it have a value?
3. Are there other manual input categories besides Envelopes, Print, and Postage?
4. What should happen to existing quotes after upgrade?
5. Do we need to support multiple envelope items per quote?
6. Should users be able to reorder line items within categories?
7. What email domain should we use for estimating@[domain].com?
8. Should quote numbers ever reset, or always increment?
9. Do revised quotes need approval workflow?
10. Any categories that should allow both manual and rate card items?

---

## SUMMARY

This is a **major system upgrade** that transforms the quote builder from a simple operation-picker into a structured, category-based estimating system that matches professional printing industry standards.

The most significant changes are:
1. **Category system** - organizing everything into 7 categories
2. **Manual inputs** - allowing direct entry for Envelopes, Print, and Postage
3. **Quote versioning** - Q0000-0 revision system
4. **Professional PDF** - matching exact client format
5. **Enhanced tracking** - knowing who did what and when

All changes align with the client PDFs provided and will result in quotes that look and function exactly like their current manual process.
