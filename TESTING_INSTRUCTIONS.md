# PDF Generation & Email Testing Instructions

## ✅ What Was Built

The PDF generation and email system has been completely rebuilt with clean, working code:

1. **Print Route** - `app/quotes/[id]/print/route.ts`
   - Server-rendered HTML with inline styles
   - No React components, no external CSS
   - Includes `#ready` marker for Puppeteer
   - System fonts only (no custom fonts)

2. **PDF Generator** - `server/pdf/generateLocal.ts`
   - Uses full `puppeteer` package (not puppeteer-core)
   - Comprehensive logging at each step
   - Waits for `#ready` marker and `networkidle0`
   - Returns PDF buffer

3. **Email Service** - `server/email/sendQuoteEmail.ts`
   - Uses Resend SDK
   - Sends HTML email with PDF link or fallback
   - DMC Encore branding

4. **API Endpoint** - `app/api/quotes/[id]/issue/route.ts`
   - POST endpoint to issue quotes
   - Generates PDF → Uploads to Supabase Storage → Sends email
   - Falls back to print page link if PDF fails
   - Logs audit trail

## 🧪 Testing Steps

### 1. Test Print Route (HTML Render)

Open your browser and navigate to a quote's print page:

```
http://localhost:3001/quotes/YOUR_QUOTE_ID/print
```

**Expected Result:**
- Full HTML quote displays instantly
- No blank screen
- DMC Encore logo, client info, line items, totals
- Check browser console - should see page loaded

**Console Output:**
```
[Print Route] Fetching quote: YOUR_QUOTE_ID
[Print Route] Quote found, lines: N
[Print Route] HTML rendered, length: NNNN
```

### 2. Test PDF Generation (via API)

You need to get a quote ID first. Log into http://localhost:3001, view a quote, and copy the ID from the URL.

Then use curl or Postman to issue the quote:

```bash
curl -X POST http://localhost:3001/api/quotes/YOUR_QUOTE_ID/issue \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"to": "your-email@example.com"}'
```

**To get your session cookie:**
1. Open browser DevTools (F12)
2. Go to Application/Storage → Cookies
3. Copy the value of the auth cookie (likely `sb-access-token` or similar)
4. Use it in the curl command above

**Expected Response:**
```json
{
  "success": true,
  "pdfUrl": "https://...supabase.co/storage/v1/object/public/quotes/QUOTE_ID.pdf",
  "emailId": "re_...",
  "pdfGenerated": true
}
```

**Console Output (detailed logging):**
```
[Issue] Generating PDF for quote QUOTE_ID
[generateLocalPdf] Starting PDF generation
[generateLocalPdf] Quote ID: QUOTE_ID
[generateLocalPdf] URL: http://localhost:3001/quotes/QUOTE_ID/print
[generateLocalPdf] Launching browser...
[generateLocalPdf] ✓ Browser launched
[generateLocalPdf] Navigating to print page...
[generateLocalPdf] ✓ Page loaded, status: 200
[generateLocalPdf] Waiting for #ready marker...
[generateLocalPdf] ✓ #ready marker found
[generateLocalPdf] Content check: { bodyLength: NNNN, hasReady: true, hasTable: true, hasHeader: true }
[generateLocalPdf] Generating PDF...
[generateLocalPdf] ✓ PDF generated, size: NNNNN bytes
[generateLocalPdf] ✓ Browser closed
[Issue] PDF generated: NNNNN bytes
[Issue] PDF uploaded, URL: https://...
[Issue] Sending email to your-email@example.com for quote QUOTE_ID
[Email] Sending quote email to: your-email@example.com
[Email] PDF URL: https://...
[Email] Email sent successfully. ID: re_...
```

### 3. Verify Results

**Check Supabase Storage:**
1. Go to https://supabase.com/dashboard
2. Navigate to your project → Storage → `quotes` bucket
3. You should see `QUOTE_ID.pdf`
4. Download and open it - should show full quote content

**Check Email:**
1. Open your email inbox
2. Look for email from "DMC Encore <paul@staxxd.co.uk>"
3. Subject: "Quote REF - DMC Encore"
4. Email should contain:
   - DMC Encore header
   - Client greeting
   - Link to PDF or print page
   - DMC Encore contact footer

**Check Database:**
1. Quote record should have `pdfUrl` populated
2. `QuoteHistory` table should have an `EMAIL_SENT` record

## 🔧 Troubleshooting

### PDF is blank or empty

**Check server console for:**
```
[generateLocalPdf] Content check: { hasTable: false, hasHeader: false }
```

This means the print route isn't rendering properly.

**Solution:**
1. Visit http://localhost:3001/quotes/YOUR_QUOTE_ID/print directly in browser
2. Check if HTML renders
3. Look for errors in browser console or server logs

### "Chrome executable not found"

**Solution:**
Already fixed! Your `.env` has:
```
CHROME_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

If this changes, update the path.

### Email not sending

**Check console for:**
```
[Email] Failed to send email: ...
```

**Common issues:**
- `RESEND_API_KEY` not set or invalid
- Email address invalid
- Resend API limits reached

**Solution:**
1. Verify `.env` has:
   ```
   RESEND_API_KEY=re_7EHmXVAF_FXXgPWfmtWQRoGo1TUcc2uWR
   RESEND_FROM_EMAIL=paul@staxxd.co.uk
   ```
2. Check Resend dashboard for errors

### PDF upload fails

**Check console for:**
```
[Issue] Storage upload failed: ...
```

**Solution:**
1. Verify Supabase storage bucket `quotes` exists
2. Check bucket is public or has proper RLS policies
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

## 📝 Environment Variables Checklist

Your `.env` should have:

```env
# Database
DATABASE_URL="postgresql://..."
SUPABASE_DB_URL="postgresql://..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Site URL (matches your dev server port)
NEXT_PUBLIC_SITE_URL="http://localhost:3001"

# PDF Generation
CHROME_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=paul@staxxd.co.uk
```

## 🚀 Quick Test Command

Once you have a quote ID, run this complete test:

```bash
# Replace QUOTE_ID and EMAIL
QUOTE_ID="your-quote-id-here"
EMAIL="your-email@example.com"

# Test print route
curl http://localhost:3001/quotes/$QUOTE_ID/print | head -50

# If that works, test PDF generation + email
# (You'll need to add your session cookie)
curl -X POST http://localhost:3001/api/quotes/$QUOTE_ID/issue \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d "{\"to\": \"$EMAIL\"}"
```

## ✨ Success Criteria

✅ Print route shows full HTML quote instantly
✅ PDF generates without errors (check console logs)
✅ PDF file appears in Supabase Storage
✅ PDF is not blank when downloaded
✅ Email arrives with working PDF link
✅ Database updated with `pdfUrl` and audit log
✅ If PDF fails, email still sends with fallback link

## 📞 Next Steps

Once testing is complete:
1. Integrate with frontend UI (add "Issue Quote" button)
2. Add client email validation
3. Consider PDF caching (don't regenerate if already exists)
4. Add PDF attachments to email (currently just links)
5. Deploy to production (will need to configure Chromium for serverless)
