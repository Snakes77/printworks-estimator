# PDF Generation & Email Testing Guide

## Files Created/Updated

✅ **app/quotes/[id]/print/route.ts**
- Server-rendered print route (no auth)
- Uses `renderToStaticMarkup` for static HTML
- Includes `#ready` element for Puppeteer
- Inline CSS with system fonts

✅ **server/pdf/generateLocal.ts**
- Local PDF generator using full `puppeteer`
- Waits for `networkidle0` and `#ready`
- Returns PDF buffer
- Console logging for debugging

✅ **server/email/sendQuoteEmail.ts**
- Simplified email service
- Sends HTML email with PDF link or fallback
- DMC Encore footer included

✅ **app/api/quotes/[id]/issue/route.ts**
- Generates PDF and uploads to Supabase Storage
- Sends email even if PDF generation fails
- Falls back to print page link if PDF unavailable
- Saves `pdfUrl` and audit record

## Environment Variables

Ensure these are set in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=paul@staxxd.co.uk
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Testing Steps

### 1. Start Development Server

```bash
npm run dev
```

Server should start on `http://localhost:3000`

### 2. Test Print Route

Open in browser:
```
http://localhost:3000/quotes/[quote-id]/print
```

**Expected:**
- Full HTML quote displays instantly
- No blank screen
- All quote details visible (client, items, totals)
- `#ready` element present in HTML

**Check console:**
- No errors
- Route returns HTML with content

### 3. Test PDF Generation

The PDF generation is tested via the issue endpoint. See step 4.

### 4. Test Issue Endpoint (PDF + Email)

**Get a quote ID first:**
- Visit `http://localhost:3000/quotes` and note a quote ID

**Send request:**
```bash
curl -X POST http://localhost:3000/api/quotes/[quote-id]/issue \
  -H "Content-Type: application/json" \
  -H "Cookie: [your-auth-cookie]" \
  -d '{"to":"you@yourdomain.com"}'
```

**Or use Postman/Insomnia:**
- Method: POST
- URL: `http://localhost:3000/api/quotes/[quote-id]/issue`
- Headers: `Content-Type: application/json`
- Body: `{"to":"you@yourdomain.com"}`
- Include authentication cookies

**Expected Response:**
```json
{
  "success": true,
  "pdfUrl": "https://xxx.supabase.co/storage/v1/object/public/quotes/[quote-id].pdf",
  "emailId": "abc123",
  "pdfGenerated": true
}
```

**Check Server Console:**
```
[Issue] Generating PDF for quote [id]
[PDF] Generating PDF for quote [id]
[PDF] URL: http://localhost:3000/quotes/[id]/print
[PDF] Launching browser...
[PDF] Page created
[PDF] Navigating to: http://localhost:3000/quotes/[id]/print
[PDF] Page loaded
[PDF] Waiting for #ready element...
[PDF] #ready element found
[PDF] Generating PDF buffer...
[PDF] PDF generated: true Size: [bytes] bytes
[PDF] Browser closed
[Issue] PDF generated: [bytes] bytes
[Issue] PDF uploaded, URL: https://...
[Issue] Sending email to you@yourdomain.com for quote [id]
[Email] Sending quote email to: you@yourdomain.com
[Email] PDF URL: https://...
[Email] Email sent successfully. ID: abc123
```

**Check Email:**
- Email arrives at recipient address
- Contains link to PDF (or fallback print page if PDF failed)
- DMC Encore branding present
- Footer with contact info

**Check PDF:**
- Click PDF link in email
- PDF opens and is not blank
- Contains full quote content
- Properly formatted

### 5. Test PDF Failure Fallback

To test fallback behavior, temporarily break PDF generation:

1. Stop dev server
2. Comment out PDF generation in `app/api/quotes/[id]/issue/route.ts`
3. Restart server
4. Send issue request

**Expected:**
- Email still sends
- Link points to `/quotes/[id]/print` (fallback)
- Response includes `"pdfGenerated": false`

## Troubleshooting

### PDF is Blank

**Check:**
1. Print route renders correctly in browser
2. `#ready` element exists in HTML
3. Puppeteer waits are sufficient (check console logs)
4. No CSS loading issues (all inline)

**Fix:**
- Increase timeout in `generateLocal.ts`
- Add more wait conditions
- Check browser console for errors

### Email Not Sending

**Check:**
1. `RESEND_API_KEY` is set correctly
2. `RESEND_FROM_EMAIL` is verified in Resend
3. Email address is valid
4. Check server console for errors

**Fix:**
- Verify Resend API key in dashboard
- Use verified email address
- Check Resend logs for errors

### Storage Upload Fails

**Check:**
1. Supabase Storage bucket `quotes` exists
2. Bucket is set to public
3. `SUPABASE_SERVICE_ROLE_KEY` is correct
4. Check server console for upload errors

**Fix:**
- Create bucket in Supabase dashboard
- Set bucket to public
- Verify service role key

### Authentication Error

**Check:**
1. User is logged in
2. User owns the quote
3. Cookies are included in request

**Fix:**
- Login via `/login` page
- Use browser dev tools to copy cookies
- Include cookies in curl/Postman request

## Console Logging

All functions include console logs for debugging:

- `[PDF]` - PDF generation steps
- `[Issue]` - Issue endpoint flow
- `[Email]` - Email sending steps

Watch the server console while testing to see the flow.

## Success Criteria

✅ Print route renders full HTML instantly
✅ PDF generation creates non-blank PDF
✅ Email sends with working PDF link
✅ PDF opens and contains all quote content
✅ Prisma record updated with `pdfUrl`
✅ Audit event logged
✅ If PDF fails, email still sends with fallback link

