# PrintWorks Estimator

PrintWorks Estimator is a production-ready replacement for the legacy Excel print estimating workbook used by commercial print teams. It delivers fast, auditable quoting, centralised rate-card management, automated PDF output, and Supabase-backed persistence designed for Vercel deployment.

## Quick Start on localhost:3000

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Set up database schema and seed data
npx prisma db push
npx prisma db seed

# 4. Create Supabase storage buckets (via Supabase dashboard):
#    - Navigate to Storage in your Supabase project
#    - Create bucket: "quotes" (for PDF files)
#    - Create bucket: "imports" (for CSV archives)
#    - Set both to public access

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Verification

Run the full test and quality suite before deployment:

```bash
npm run verify
```

This runs:
- TypeScript type checking
- ESLint
- Unit tests (pricing logic, audit trail)
- E2E tests (quote workflows)
- Environment validation

## Features

- **Supabase Auth** via email magic links with session-aware routing.
- **Rate-card management** with banded pricing, make-ready fees, and import wizard for CSV migrations.
- **Guided quote builder** with insert-aware enclosing logic, live totals, VAT toggle, and draft/final workflows.
- **Audit history** for every quote including recalculations and PDF exports.
- **PDF generation** using Puppeteer and Supabase Storage for client-ready downloads.
- **Type-safe backend** built on Next.js App Router, tRPC, Prisma, and Supabase Postgres.
- **Testing harness** with Jest unit coverage for pricing logic and Playwright smoke test for auth flow.

## Project Structure

```
app/                # Next.js App Router pages (dashboard, quotes, rate cards, import, login)
components/         # Reusable UI, layout, and feature components
lib/                # Prisma, Supabase, pricing helpers, utilities
prisma/             # Prisma schema and seed data
server/api/         # tRPC router definitions
server/pdf/         # Puppeteer PDF generator
tests/              # Jest unit tests and Playwright E2E specs
```

## Prerequisites

- Node.js 18.18+ (or Node.js 20 LTS)
- npm 9+ (pnpm/yarn also work but scripts assume npm)
- Supabase project with Database, Auth, and Storage enabled
- Vercel account (for deployment)

## Environment Variables

Copy `.env.example` to `.env.local` and populate the values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` come from Supabase project settings.
- `SUPABASE_SERVICE_ROLE_KEY` is required for secure server-side actions (PDF storage, imports).
- `SUPABASE_DB_URL` should be the connection string for the Supabase Postgres instance.
- `NEXT_PUBLIC_SITE_URL` is used when launching Puppeteer; set to the public Vercel domain in production.

## Supabase Setup

1. Create a new Supabase project.
2. Enable **Email (magic link)** authentication (`Authentication → Providers`).
3. Create Storage buckets:
   - `quotes` (for generated PDFs)
   - `imports` (for archived CSV uploads)
4. Run the Prisma schema against the Supabase database:

   ```bash
   npm install
   npx prisma db push
   npx prisma db seed
   ```

   The seed script provisions sample rate cards and a demo user.

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Visit `/login` to request a magic link (check Supabase Auth → Users to confirm delivery).

## Testing

### Unit tests

```bash
npm test
```

`tests/pricing.test.ts` validates band selection, unit calculations (including insert-aware enclosing), and VAT totals.

### Playwright E2E

```bash
npm run test:e2e
```

Make sure `npm run dev` (or your deployed URL via `PLAYWRIGHT_BASE_URL`) is running before executing the Playwright suite. The included smoke test verifies magic link UI rendering; extend it to cover quoting flows once Supabase credentials are configured for automated sessions.

## PDF Generation

The PDF workflow uses `puppeteer-core` with `@sparticuz/chromium`, which is compatible with Vercel serverless functions. During local development Puppeteer will download a Chromium binary automatically. Set `NEXT_PUBLIC_SITE_URL` to the deployed Vercel domain so the generated PDFs resolve absolute asset URLs when hosted.

When a quote is finalised, `trpc.quotes.generatePdf` renders the PDF, uploads it to the `quotes` bucket, records the public URL, and logs an audit event.

## Importing Legacy Rate Cards

1. Navigate to `/import`.
2. Upload a CSV with headers: `code,name,unit,fromQty,toQty,pricePerThousand,makeReadyFixed`.
3. Review the parsed preview and summary.
4. Click **Import rate cards** to upsert into Supabase and archive the CSV in the `imports` bucket.

## Deployment to Vercel

1. Push this repository to GitHub and connect it to Vercel.
2. Configure the following environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_URL`
   - `NEXT_PUBLIC_SITE_URL` (set to the Vercel production URL)
3. Run migrations/seed from your local machine as required:

   ```bash
   npx prisma db push --schema prisma/schema.prisma
   npx prisma db seed
   ```

4. Deploy:

   ```bash
   vercel --prod
   ```

## Additional Notes

- All money is formatted in GBP with UK English spellings throughout the UI and PDF output.
- The Prisma schema includes a `QuoteHistory` model for the audit trail; every create/update/PDF event appends structured JSON payloads.
- The UI uses Tailwind CSS with a light theme and shadcn-inspired components customised for the PrintWorks brand palette.
- Puppeteer can be memory intensive; if you plan to batch-generate PDFs, consider moving the mutation to a Supabase Edge Function or background job.
- For production auth hardening, add domain restrictions to Supabase email sign-in and configure role-based permissions (the schema is ready to extend for roles).

## Roadmap Ideas

- Versioned rate cards to preserve historical pricing per quote.
- Cost-price tracking and margin dashboards for sales leadership.
- Role-based access (Sales vs Admin) surfaced via Supabase Row Level Security.
- Tailwind-powered dark mode toggle synchronised with user preferences.
- Analytics screens (average job size, profit per operation, quotes per client) fed by Supabase SQL views.
