# Authentication Fix for API Testing

## The Issue

The error `{"statusCode":"400","error":"InvalidJWT","message":"\"exp\" claim timestamp check failed"}` means your Supabase session token has expired.

The API endpoint `/api/quotes/[id]/issue` requires authentication because it calls `getAuthenticatedUser()`.

## Solution Options

### Option 1: Test via Browser (Easiest)

Instead of using curl, let's create a simple test page in your app that you can click:

1. **Login to your app** at http://localhost:3001/login
2. **Navigate to a quote** page
3. **Use browser DevTools Console** to test:

```javascript
// Open DevTools Console (F12) and paste this:
fetch('/api/quotes/cmhl0sjis0002nriqf5gdd5wt/issue', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ to: 'your-email@example.com' })
})
  .then(res => res.json())
  .then(data => console.log('Success:', data))
  .catch(err => console.error('Error:', err));
```

This automatically includes your session cookies!

### Option 2: Get Fresh Session Cookie

1. **Login fresh** at http://localhost:3001/login
2. **Open DevTools** (F12) → Application/Storage → Cookies
3. **Find these cookies:**
   - `sb-nlkzpiiqizbkxnuxlsnq-auth-token` (or similar)
   - Look for any cookie starting with `sb-`
4. **Copy the FULL cookie string** including name and value
5. **Use in curl:**

```bash
curl -X POST http://localhost:3001/api/quotes/cmhl0sjis0002nriqf5gdd5wt/issue \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-nlkzpiiqizbkxnuxlsnq-auth-token=YOUR_TOKEN_HERE; sb-nlkzpiiqizbkxnuxlsnq-auth-token-code-verifier=VERIFIER_HERE" \
  -d '{"to": "your-email@example.com"}'
```

### Option 3: Create a Test Button in the UI

Let me create a quick test component you can add to your quote view page.

Add this to `components/quotes/quote-view.tsx` (or create a test page):

```typescript
// Add to your component
const testIssue = async () => {
  try {
    const response = await fetch(`/api/quotes/${quote.id}/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: 'your-email@example.com' }),
    });

    const data = await response.json();
    console.log('Issue result:', data);

    if (data.success) {
      alert(`Success! PDF URL: ${data.pdfUrl}`);
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (error) {
    console.error('Issue error:', error);
    alert('Failed to issue quote');
  }
};

// Add this button to your JSX
<Button onClick={testIssue}>
  Test Issue Quote
</Button>
```

### Option 4: Bypass Auth for Testing (Temporary)

If you just want to test PDF generation without dealing with auth, temporarily comment out the auth check:

In `app/api/quotes/[id]/issue/route.ts`, change:

```typescript
// TEMPORARILY comment out for testing
// const user = await getAuthenticatedUser();

// Add this temporary line instead:
const user = { id: 'test-user-id' }; // TODO: Remove after testing
```

**⚠️ IMPORTANT:** Remember to uncomment the real auth before deploying!

## Recommended Testing Flow

**Best approach for quick testing:**

1. **Login to your app**
   ```
   http://localhost:3001/login
   ```

2. **Open any quote page**
   ```
   http://localhost:3001/quotes/cmhl0sjis0002nriqf5gdd5wt
   ```

3. **Open Browser Console** (F12 → Console tab)

4. **Paste this JavaScript:**
   ```javascript
   fetch('/api/quotes/cmhl0sjis0002nriqf5gdd5wt/issue', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ to: 'paul@staxxd.co.uk' })
   })
   .then(r => r.json())
   .then(d => {
     console.log('✅ Success!');
     console.log('PDF URL:', d.pdfUrl);
     console.log('Email ID:', d.emailId);
     console.log('Full response:', d);
   })
   .catch(e => {
     console.error('❌ Error:', e);
   });
   ```

5. **Check the response** in console

6. **Check server logs** for detailed PDF generation logs:
   ```
   [generateLocalPdf] Starting PDF generation
   [generateLocalPdf] ✓ Browser launched
   [generateLocalPdf] ✓ Page loaded
   [generateLocalPdf] ✓ PDF generated
   [Email] Email sent successfully
   ```

## Verify Success

After running the test, check:

1. **Browser Console** - Should show success response with `pdfUrl`
2. **Server Console** - Should show detailed logs of PDF generation
3. **Supabase Storage** - Check the `quotes` bucket for the PDF file
4. **Email Inbox** - Check for email from DMC Encore

## Common Issues

### "InvalidJWT" or "exp claim failed"
**Cause:** Session expired
**Fix:** Login again in the browser

### "Unauthorized" or 403 error
**Cause:** Quote doesn't belong to logged-in user
**Fix:** Make sure you're logged in as the user who created the quote

### "Quote not found" or 404 error
**Cause:** Quote ID doesn't exist
**Fix:** Run `node scripts/get-quote-id.mjs` to get a valid ID

### No console logs appearing
**Cause:** Server might be using a different process
**Fix:** Check all terminal windows for Next.js dev server output

## Example Success Output

**Browser Console:**
```json
{
  "success": true,
  "pdfUrl": "https://nlkzpiiqizbkxnuxlsnq.supabase.co/storage/v1/object/public/quotes/cmhl0sjis0002nriqf5gdd5wt.pdf",
  "emailId": "re_abc123xyz",
  "pdfGenerated": true
}
```

**Server Console:**
```
[Issue] Generating PDF for quote cmhl0sjis0002nriqf5gdd5wt
[generateLocalPdf] Starting PDF generation
[generateLocalPdf] Quote ID: cmhl0sjis0002nriqf5gdd5wt
[generateLocalPdf] Launching browser...
[generateLocalPdf] ✓ Browser launched
[generateLocalPdf] Navigating to print page...
[generateLocalPdf] ✓ Page loaded, status: 200
[generateLocalPdf] Waiting for #ready marker...
[generateLocalPdf] ✓ #ready marker found
[generateLocalPdf] Content check: { bodyLength: 4521, hasReady: true, hasTable: true, hasHeader: true }
[generateLocalPdf] Generating PDF...
[generateLocalPdf] ✓ PDF generated, size: 15234 bytes
[generateLocalPdf] ✓ Browser closed
[Issue] PDF generated: 15234 bytes
[Issue] PDF uploaded, URL: https://...
[Issue] Sending email to paul@staxxd.co.uk
[Email] Email sent successfully. ID: re_abc123xyz
```

---

**TL;DR:** Just login to your app, open a quote page, open browser console (F12), and paste the fetch command above. It's much easier than dealing with curl and cookies!
