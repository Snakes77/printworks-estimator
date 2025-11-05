# Google Apps Script Setup Guide

## Quick Start (30 minutes)

### Step 1: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "PrintWorks Estimator"

### Step 2: Open Apps Script Editor

1. In your spreadsheet, click **Extensions** → **Apps Script**
2. Delete the default `myFunction` code
3. Copy all code from `PrintWorksEstimator.gs` and paste it
4. Click **File** → **New** → **HTML file**
5. Name it `Index`
6. Copy all code from `Index.html` and paste it
7. Click **Save** (💾 icon)

### Step 3: Initialize Sheets

1. In the Apps Script editor, click **Run** → `initializeAllSheets`
2. Go back to your spreadsheet - you should see 5 new sheets:
   - RateCards
   - Bands
   - Quotes
   - QuoteLines
   - History

### Step 4: Add Sample Rate Cards

Manually add some rate cards to test (or import from CSV later):

**In RateCards sheet:**
```
Code      | Name            | Unit   | Notes
----------|-----------------|--------|-------
ENV-001   | Envelopes       | per_1k |
PRT-001   | Print           | per_1k |
FOLD-001  | Folding         | per_1k |
ENC-001   | Enclosing       | enclose|
```

**In Bands sheet:**
```
RateCardCode | FromQty | ToQty   | PricePerThousand | MakeReadyFixed
-------------|---------|---------|------------------|----------------
ENV-001      | 1       | 10000   | 22.90           | 0
PRT-001      | 1       | 10000   | 60.00           | 0
PRT-001      | 10001   | 50000   | 50.00           | 0
FOLD-001     | 1       | 50000   | 15.00           | 20
ENC-001      | 1       | 10000   | 25.00           | 50
```

### Step 5: Deploy as Web App

1. In Apps Script editor, click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Set:
   - **Description**: PrintWorks Estimator v1
   - **Execute as**: Me
   - **Who has access**: Anyone (or your organization)
5. Click **Deploy**
6. Copy the **Web app URL**

### Step 6: Test It!

1. Open the Web app URL in a new tab
2. Fill in quote details
3. Add operations
4. Watch totals calculate automatically
5. Click "Save and Finalise"
6. Check your Quotes sheet - your quote should be there!

---

## Features

✅ **Automatic band selection** - No manual picking needed  
✅ **Live calculation** - Totals update as you type  
✅ **Insert-aware** - Enclosing calculations multiply correctly  
✅ **VAT handling** - 20% or 0%  
✅ **Clean UI** - Simple, focused interface  
✅ **Audit trail** - Every quote saved to History  

---

## Import Rate Cards from CSV

You can bulk import rate cards:

1. Prepare CSV with columns:
   ```
   code,name,unit,fromQty,toQty,pricePerThousand,makeReadyFixed
   ENV-001,Envelopes,per_1k,1,10000,22.90,0
   ```

2. In Apps Script editor, add this function:
   ```javascript
   function importRateCards(csvData) {
     const rows = Utilities.parseCsv(csvData);
     const bandsSheet = getSheet(CONFIG.SHEETS.BANDS);
     
     for (let i = 1; i < rows.length; i++) {
       const row = rows[i];
       // Add rate card if new
       // Add band
     }
   }
   ```

---

## Customization

### Change VAT Rate Options

Edit `Index.html`, find:
```html
<select id="vatRate" name="vatRate" required>
  <option value="20">Standard VAT (20%)</option>
  <option value="0">Zero rated (0%)</option>
</select>
```

### Add More Envelope Types

Edit `Index.html`, find:
```html
<select id="envelopeType" name="envelopeType" required>
  <option value="C5">C5</option>
  <option value="C4">C4</option>
  <option value="DL">DL</option>
</select>
```

### Styling

Edit the `<style>` section in `Index.html` to customize colors, fonts, etc.

---

## Troubleshooting

### "No band found" error
- Check that bands exist in Bands sheet
- Verify quantity falls within band range (FromQty ≤ quantity ≤ ToQty)

### Totals not updating
- Make sure JavaScript is enabled
- Check browser console for errors (F12)

### Rate cards not showing
- Verify RateCards sheet has data
- Check column headers match: Code, Name, Unit, Notes, CreatedAt

### Web app not loading
- Check deployment settings (Execute as: Me, Who has access: Anyone)
- Make sure you're logged into correct Google account

---

## Next Steps

### Add PDF Generation

1. Use `DocumentApp` to create Google Doc
2. Format with quote details
3. Export as PDF
4. Store in Google Drive
5. Add PDF URL to Quotes sheet

### Add Email Sending

```javascript
function emailQuote(quoteId, recipientEmail) {
  const quote = getQuote(quoteId);
  const pdfUrl = getQuotePDFUrl(quoteId);
  
  MailApp.sendEmail({
    to: recipientEmail,
    subject: `Quote: ${quote.reference}`,
    htmlBody: `Quote attached: ${pdfUrl}`
  });
}
```

### Add Search/Filter

Add QUERY formulas to Sheets or build search UI in HTML.

---

## Support

If you get stuck:
1. Check Apps Script execution logs (View → Execution log)
2. Check browser console (F12 → Console)
3. Verify sheet structure matches expected format
4. Test individual functions in Apps Script editor (Run → function name)

---

## Migration from Next.js

Your existing data can be migrated:

1. **Export from Supabase:**
   ```sql
   SELECT * FROM "RateCard";
   SELECT * FROM "Band";
   ```

2. **Import to Sheets:**
   - Copy/paste into RateCards and Bands sheets
   - Or use CSV import function

3. **Export quotes:**
   ```sql
   SELECT * FROM "Quote";
   SELECT * FROM "QuoteLine";
   ```

4. **Import to Sheets:**
   - Copy/paste into Quotes and QuoteLines sheets

---

## Performance Tips

- **Limit sheets to 10,000 rows** - Add archive sheets if needed
- **Use batch operations** - Update multiple rows at once
- **Cache rate cards** - Load once, reuse in memory
- **Index frequently queried columns** - Use QUERY formulas

---

## Security

- **Share Sheet carefully** - Use Google Workspace permissions
- **Validate inputs** - Check data before saving
- **Audit logs** - All actions logged to History sheet
- **Backup regularly** - Use Google Drive version history

---

**That's it! You now have a working quote system.**

No bugs. No complexity. Just works.

