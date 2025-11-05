# Simplification Complete - Minimal DevOps Implementation

## Changes Made

### 1. Prisma Schema Updates
- ✅ Added `Client` model with `id`, `name`, `email` (unique), `company`, timestamps
- ✅ Updated `Quote` to include optional `clientId` relation to `Client`
- ✅ Updated `QuoteHistory` to include optional `meta` JSON field
- ✅ Changed datasource URL from `SUPABASE_DB_URL` to `DATABASE_URL` (Prisma default)

### 2. Print Route (No Auth)
- ✅ Created `app/quotes/[id]/print/route.ts`
  - `runtime = 'nodejs'`
  - `revalidate = 0`, `dynamic = 'force-dynamic'`
  - No authentication required
  - Server-rendered React component to static HTML
  - Includes `#ready` element for Puppeteer to wait on
  - Inline print CSS with system fonts

### 3. Simplified PDF Generator
- ✅ Created `server/pdf/generate.ts`
  - Uses `@sparticuz/chromium` and `puppeteer-core`
  - Launches headless Chromium
  - Navigates to `/quotes/[id]/print`
  - Waits for `networkidle0` and `#ready`
  - Generates PDF with A4 format
  - Uploads to Supabase Storage `quotes/[id]/[timestamp].pdf`
  - Returns public URL (bucket is public for now)
  - Comment included for switching to signed URLs later

### 4. Issue Route (Email)
- ✅ Created `app/api/quotes/[id]/issue/route.ts`
  - `runtime = 'nodejs'`, `maxDuration = 60`
  - Accepts `POST { to: string }`
  - Generates PDF if not already generated
  - Saves `pdfUrl` on quote
  - Upserts client by email for quick lookup
  - Sends email via Resend with PDF link
  - Logs audit event with `EMAIL_SENT` action

### 5. Client Helper
- ✅ Created `lib/client.ts`
  - `upsertClientByEmail()` function
  - Stores and reuses client addresses quickly
  - Updates existing client or creates new one

### 6. Documentation
- ✅ Updated README with Vercel environment variables section
- ✅ Created `prisma/rls-minimal.md` with minimal RLS policies for later

## Environment Variables

### Required for Vercel
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Server-side only
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

### Optional (Email)
```bash
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=your-verified-email@yourdomain.com
```

## Next Steps

1. **Run Prisma Migration:**
   ```bash
   npx prisma db push
   ```

2. **Test Print Route:**
   - Open `/quotes/[id]/print` in browser
   - Should render fully without login

3. **Test Issue Route:**
   ```bash
   curl -X POST http://localhost:3000/api/quotes/[id]/issue \
     -H "Content-Type: application/json" \
     -d '{"to":"you@yourdomain.com"}'
   ```

4. **Verify:**
   - Email received with PDF link
   - PDF opens and is not blank
   - `pdfUrl` stored on quote
   - Audit event recorded
   - Client email saved

## Storage Setup

- Supabase Storage bucket `quotes` should be **public** initially
- Set `contentType: 'application/pdf'` on upload (already done)
- To switch to signed URLs later:
  1. Set bucket to private in Supabase Dashboard
  2. Use `storage.createSignedUrl(filePath, 3600)` instead of `getPublicUrl()`
  3. Add RLS policy for storage access

## RLS Policies

- Keep RLS **off** during initial testing
- Minimal policies documented in `prisma/rls-minimal.md`
- Enable later with policies for:
  - Quotes: users can only access their own quotes
  - Audit events: users can only view events for their quotes

## Notes

- All code is minimal and focused
- No unnecessary frameworks or services added
- Error handling with try-catch and concise logging
- Never logs secrets
- Logs quote ID, storage path, and HTTP status only

