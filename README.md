# PrintWorks Estimator - DMC Encore

A production-ready web application for commercial print estimating, built for **DMC Encore** - direct mail, fulfilment and logistics specialists since 1986. This system replaces legacy Excel workbooks with a modern, auditable quoting platform featuring automated PDF generation, email delivery, and centralized rate-card management.

## 🎯 Key Features

- **📊 Rate Card Management** - Create and manage pricing templates with banded pricing, quantity ranges, and make-ready fees
- **💰 Quote Builder** - Interactive quote creation with insert-aware calculations, live totals, and draft/final workflows
- **📄 PDF Generation** - Professional branded PDF quotes with DMC Encore branding, generated instantly
- **📧 Email Delivery** - Send quote PDFs directly to clients via email using Resend
- **📋 Audit History** - Complete audit trail for every quote change, PDF generation, and email sent
- **📥 CSV Import** - Migrate legacy rate cards from Excel/CSV files with validation and preview
- **🔐 Secure Authentication** - Supabase Auth with magic links, Row-Level Security (RLS), and ownership verification
- **🎨 Branded UI** - Custom DMC Encore branding throughout the application

## 🚀 Quick Start

### Prerequisites

- Node.js 18.18+ (or Node.js 20 LTS)
- npm 9+ (pnpm/yarn also work)
- Supabase project with Database, Auth, and Storage enabled
- Resend account (for email functionality)
- Vercel account (for deployment)

### Installation

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your credentials (see Environment Variables below)

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

## 📝 Environment Variables

Copy `.env.example` to `.env.local` and populate the values:

### Required for Vercel Deployment

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Server-side only, never exposed to client
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Application URL (used for PDF generation)
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app  # Set to production URL in Vercel
```

### Optional (for Email Functionality)

```bash
# Resend Email Configuration
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=your-verified-email@yourdomain.com
```

**Note on Email Setup:**
- For development/testing: Use a verified email address (e.g., `paul@staxxd.co.uk`)
- For production: Verify your domain in Resend (https://resend.com/domains) and use a professional address like `noreply@yourdomain.com` or `quotes@yourdomain.com`
- Without Resend configuration, PDF generation still works, but email sending will be disabled

**Important:** 
- `DATABASE_URL` is used by Prisma (default convention)
- `SUPABASE_DB_URL` can be used as an alias, but Prisma expects `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser - it bypasses RLS

## 🏗️ Project Structure

```
app/                    # Next.js App Router pages
├── (app)/              # Protected application routes
│   ├── quotes/         # Quote management (list, create, view, edit)
│   ├── rate-cards/     # Rate card management
│   └── import/         # CSV rate card import
├── (auth)/             # Authentication routes
│   └── login/          # Magic link login
├── api/                # API routes
│   └── trpc/           # tRPC API endpoint
└── quotes/[id]/pdf/    # PDF generation route

components/             # React components
├── auth/               # Authentication components
├── layout/             # Layout components (AppShell, navigation)
├── quotes/             # Quote-related components
├── rate-cards/         # Rate card components
└── ui/                 # Reusable UI components (shadcn)

lib/                    # Core libraries
├── brand.ts            # DMC Encore brand configuration
├── pricing.ts          # Pricing calculation logic
├── prisma.ts           # Prisma client
├── email.ts            # Resend email service
├── auth.ts             # Authentication helpers
└── supabase/           # Supabase client configuration

server/
├── api/                # tRPC routers
│   └── routers/        # Quote, rate-card, import routers
└── pdf/                # PDF generation with Puppeteer

prisma/
├── schema.prisma       # Database schema
└── seed.ts             # Seed data

tests/                  # Test suites
├── pricing.spec.ts     # Unit tests for pricing logic
└── e2e/                # Playwright E2E tests
```

## 🔐 Security Features

- ✅ **Full authentication required** on all routes (no demo user bypass)
- ✅ **Row-level security (RLS)** on all database tables
- ✅ **Ownership verification** on all quote operations
- ✅ **Rate limiting** on expensive operations:
  - PDF generation: 10/minute per user
  - CSV import: 5/hour per user
  - Quote creation: 50/hour per user
- ✅ **Private storage** with signed URLs (5-minute expiry)
- ✅ **Input validation** with strict Zod schemas (prevents injection, overflow)
- ✅ **SSRF protection** in PDF generation (validates URLs, blocks internal IPs)
- ✅ **File upload security** (size limits, sanitization, extension validation)
- ✅ **Secure session handling** using `auth.getUser()` (not `getSession()`)

## 🧪 Testing

### Run All Tests

```bash
npm run verify
```

This runs:
- TypeScript type checking
- ESLint
- Unit tests (pricing logic, audit trail)
- E2E tests (quote workflows)
- Environment validation

### Individual Test Commands

```bash
# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Unit tests
npm test
npm run test:watch

# E2E tests (requires dev server running)
npm run test:e2e
npm run test:e2e:ui
```

## 📄 PDF Generation

PDF generation uses Puppeteer with `@sparticuz/chromium` (Vercel-compatible). The system:

1. Renders quote content in a dedicated print-optimized route
2. Generates a branded PDF with DMC Encore logo and styling
3. Uploads PDF to Supabase Storage (`quotes` bucket)
4. Records the public URL in the quote record
5. Logs an audit event

**Features:**
- Branded with DMC Encore logo and colors
- Professional layout with client details, items table, and totals
- Print-optimized CSS (no navigation elements)
- Automatic font loading and content rendering

## 📧 Email Functionality

Send quote PDFs directly to clients via email:

1. Navigate to a quote detail page
2. Click "Send Email"
3. Enter recipient email address
4. PDF is generated (if not already generated) and attached
5. Email is sent with branded HTML template and PDF link
6. Audit event is logged

**Requirements:**
- Resend API key configured in `.env.local`
- Verified email address or domain in Resend
- For testing: Use your verified email address
- For production: Verify your domain for professional sender addresses

## 📥 CSV Rate Card Import

Import legacy rate cards from CSV files:

1. Navigate to `/import`
2. Upload CSV with headers: `code`, `name`, `unit`, `fromQty`, `toQty`, `pricePerThousand`, `makeReadyFixed`
3. Review parsed preview and summary
4. Click "Import rate cards" to upsert into database
5. CSV is archived in Supabase Storage (`imports` bucket)

**Security:**
- File size limits (10MB max)
- Row limits (10,000 rows max)
- Input validation and sanitization
- CSV parsing with error handling

## 🎨 Branding

The application is fully branded for **DMC Encore**:

- **Colors:** Primary blue (#274472), accent purple (#81599f), secondary teal (#7EBEC5)
- **Fonts:** Futura PT (with system fallbacks)
- **Logo:** DMC Encore logo from dmc-encore.co.uk
- **Contact Info:** Fulfilment and Direct Mail phone numbers
- **Tagline:** "Direct mail, fulfilment and logistics specialists since 1986"

Brand configuration is centralized in `lib/brand.ts` and used throughout:
- PDF quotes
- Email templates
- Login page
- Application metadata

## 🚢 Deployment to Vercel

1. **Push to GitHub** and connect to Vercel

2. **Configure Environment Variables** in Vercel project settings:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   SUPABASE_DB_URL
   NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
   RESEND_API_KEY
   RESEND_FROM_EMAIL
   ```

3. **Run Database Migrations** (from local machine):
   ```bash
   npx prisma db push --schema prisma/schema.prisma
   npx prisma db seed
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

5. **Verify Storage Buckets** in Supabase dashboard:
   - Ensure `quotes` and `imports` buckets exist and are public

## 📊 Key Business Logic

### Pricing Calculations

- **Banded Pricing:** Automatic volume discounts based on quantity ranges
- **Insert-Aware Enclosing:** Units calculated as `quantity × inserts ÷ 1000` for enclosing operations
- **Make-Ready Fees:** Fixed setup fees per operation
- **Precise Calculations:** Uses `decimal.js` for financial accuracy (no floating-point errors)

### Quote Workflow

1. **Draft:** Create quote with items and calculations
2. **Final:** Mark quote as final (can still edit)
3. **PDF Generation:** Generate branded PDF (stored in Supabase)
4. **Email Delivery:** Send PDF to client via email
5. **Audit Trail:** Every action logged with timestamp and user

### Rate Card Units

- **per_1k:** Price per thousand units (standard)
- **enclose:** Insert-aware multiplication (quantity × inserts ÷ 1000)
- **job:** Flat fee per job (no volume calculation)

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run lint:fix     # Fix ESLint errors
npm test             # Run unit tests
npm run test:watch   # Watch mode for tests
npm run test:e2e     # Run E2E tests
npm run verify       # Run full test suite
```

### Database Commands

```bash
npx prisma generate        # Generate Prisma client
npx prisma db push         # Push schema to database
npx prisma db seed         # Seed database
npx prisma db reset        # Reset database (dev only)
npm run db:reset           # Reset and reseed
```

## 📚 Additional Documentation

- `PrintWorks-Estimator-System-Overview.md` - Detailed system overview
- `DEVOPS_AUDIT_REPORT.md` - Security audit and fixes
- `prisma/schema.prisma` - Database schema documentation

## 🗺️ Roadmap

Potential future enhancements:

- Versioned rate cards to preserve historical pricing per quote
- Cost-price tracking and margin dashboards for sales leadership
- Role-based access (Sales vs Admin) via Supabase RLS
- Dark mode toggle
- Analytics screens (average job size, profit per operation, quotes per client)
- Multi-currency support
- Quote templates and duplication

## 📄 License

Private project for DMC Encore.

## 🤝 Support

For issues or questions, contact the development team.

---

**Built for DMC Encore** - Direct mail, fulfilment and logistics specialists since 1986
