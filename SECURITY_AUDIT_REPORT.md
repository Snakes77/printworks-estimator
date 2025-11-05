# 🔴 CRITICAL SECURITY AUDIT REPORT
## PrintWorks Estimator - Pre-Production Security Review

**Date:** Immediate  
**Auditor:** Senior Security Engineer  
**Status:** 🚨 **CRITICAL ISSUES FOUND - DO NOT DEPLOY**

---

## EXECUTIVE SUMMARY

**12 CRITICAL vulnerabilities** found that would allow:
- Complete authentication bypass
- Unauthorized access to all quotes and client data
- Server-Side Request Forgery (SSRF) attacks
- Financial calculation manipulation
- Database enumeration

**Recommendation:** **BLOCK PRODUCTION DEPLOYMENT** until all critical issues are resolved.

---

## 🔴 CRITICAL VULNERABILITIES

### 1. CRITICAL: Authentication Bypass in Production

**Location:** `server/api/trpc.ts:12-22`

**Code:**
```typescript
// TEMPORARY: Use demo user for development
const demoUser = user || {
  id: 'demo-user-id',
  email: 'dave@example.co.uk',
  // ... demo user object
};

return {
  user: demoUser as any  // ⚠️ ALWAYS RETURNS USER
};
```

**Vulnerability:** 
- If `supabase.auth.getUser()` fails or returns null, system **ALWAYS** creates a demo user
- Demo user has full access to all protected endpoints
- **NO CHECK** for production environment

**Exploit Scenario:**
1. Attacker makes request without valid auth token
2. System falls back to demo user
3. Attacker gains full access to all quotes, rate cards, PDF generation
4. Can create, read, update, delete any quote

**Business Impact:**
- Complete system compromise
- Access to all client data (client names, projects, pricing)
- Ability to manipulate quotes
- Financial fraud potential

**Fix Required:**
```typescript
export const createTRPCContext = async () => {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // REMOVE DEMO USER - Require authentication
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  return {
    supabase,
    prisma,
    user: user
  };
};
```

**Severity:** 🔴 **CRITICAL**

---

### 2. CRITICAL: No Authorization Check on Quote Access

**Location:** `server/api/routers/quotes.ts:110-157`

**Code:**
```typescript
get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
  const quote = await ctx.prisma.quote.findUnique({
    where: { id: input.id },  // ⚠️ NO userId CHECK
    // ...
  });
  
  if (!quote) {
    throw new Error('Quote not found');
  }
  
  return quote;  // ⚠️ RETURNS QUOTE WITHOUT OWNERSHIP CHECK
})
```

**Vulnerability:**
- Any authenticated user can access ANY quote by guessing/knowing the ID
- No check that `quote.userId === ctx.user.id`
- Quote IDs are CUIDs (predictable pattern)

**Exploit Scenario:**
1. Attacker authenticates with their own account
2. Enumerates quote IDs (e.g., `clx123...`, `clx124...`)
3. Accesses competitor quotes to see:
   - Client names
   - Pricing strategies
   - Project details
   - Historical quotes

**Business Impact:**
- Complete data breach of competitor/client information
- Pricing strategy exposure
- Compliance violations (GDPR, data protection)

**Fix Required:**
```typescript
get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
  const user = await ensurePrismaUser(ctx.user);
  
  const quote = await ctx.prisma.quote.findUnique({
    where: { id: input.id },
    // ...
  });

  if (!quote) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }

  // ADD AUTHORIZATION CHECK
  if (quote.userId !== user.id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
  }

  return quote;
})
```

**Severity:** 🔴 **CRITICAL**

---

### 3. CRITICAL: No Authorization Check on Quote Update

**Location:** `server/api/routers/quotes.ts:261-345`

**Code:**
```typescript
update: protectedProcedure
  .input(quotePayloadSchema.extend({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.quote.findUnique({
      where: { id: input.id },  // ⚠️ NO userId CHECK
    });

    if (!existing) {
      throw new Error('Quote not found');
    }
    
    // ⚠️ ALLOWS UPDATE WITHOUT OWNERSHIP CHECK
    await ctx.prisma.quote.update({
      where: { id: input.id },
      // ...
    });
  })
```

**Vulnerability:**
- Any authenticated user can modify ANY quote
- Can change prices, quantities, client names
- Can regenerate PDFs for other users' quotes

**Exploit Scenario:**
1. Attacker modifies competitor's quote
2. Changes pricing to incorrect values
3. Regenerates PDF with wrong prices
4. Sends to client, causing business damage

**Business Impact:**
- Financial fraud
- Reputation damage
- Legal liability

**Fix Required:**
```typescript
update: protectedProcedure
  .input(quotePayloadSchema.extend({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const user = await ensurePrismaUser(ctx.user);
    
    const existing = await ctx.prisma.quote.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    // ADD AUTHORIZATION CHECK
    if (existing.userId !== user.id) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot modify quotes owned by others' });
    }

    // ... rest of update logic
  })
```

**Severity:** 🔴 **CRITICAL**

---

### 4. CRITICAL: PDF Generation Authorization Bypass

**Location:** `server/api/routers/quotes.ts:346-383`

**Code:**
```typescript
generatePdf: protectedProcedure
  .input(z.object({ quoteId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const { pdf, totals } = await generateQuotePdfBuffer(input.quoteId);
    // ⚠️ NO CHECK IF USER OWNS QUOTE
```

**Vulnerability:**
- Any authenticated user can generate PDFs for any quote
- PDF contains sensitive client information
- No authorization check in `generateQuotePdfBuffer()`

**Exploit Scenario:**
1. Attacker generates PDFs for competitor quotes
2. Downloads sensitive client information
3. Uses information for competitive advantage

**Business Impact:**
- Data breach
- Competitive intelligence theft
- Compliance violations

**Fix Required:**
```typescript
generatePdf: protectedProcedure
  .input(z.object({ quoteId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const user = await ensurePrismaUser(ctx.user);
    
    // CHECK OWNERSHIP FIRST
    const quote = await ctx.prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: { userId: true }
    });

    if (!quote) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    if (quote.userId !== user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    const { pdf, totals } = await generateQuotePdfBuffer(input.quoteId);
    // ... rest of code
  })
```

**Severity:** 🔴 **CRITICAL**

---

### 5. CRITICAL: Unprotected PDF Route (SSRF Risk)

**Location:** `app/(app)/quotes/[id]/pdf/page.tsx:7-56`

**Code:**
```typescript
export default async function QuotePdfPage({ params }: { params: { id: string } }) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },  // ⚠️ NO AUTH CHECK
  });
  // ... renders PDF
}
```

**Vulnerability:**
- Page route has **NO authentication middleware**
- Anyone with quote ID can access PDF
- Used by Puppeteer, creating SSRF risk

**Exploit Scenario:**
1. Attacker discovers quote ID
2. Directly accesses `/quotes/{id}/pdf`
3. Gets PDF without authentication
4. Can enumerate all quote IDs

**Business Impact:**
- Unauthorized PDF access
- Data enumeration
- SSRF attack vector

**Fix Required:**
```typescript
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function QuotePdfPage({ params }: { params: { id: string } }) {
  // ADD AUTHENTICATION CHECK
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { user: true }
  });

  if (!quote) {
    notFound();
  }

  // ADD AUTHORIZATION CHECK
  if (quote.userId !== user.id) {
    notFound(); // Don't reveal quote exists
  }

  // ... rest of code
}
```

**Severity:** 🔴 **CRITICAL**

---

### 6. CRITICAL: Unprotected Quote Detail Page

**Location:** `app/(app)/quotes/[id]/page.tsx:7-67`

**Code:**
```typescript
export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },  // ⚠️ NO AUTH CHECK
  });
  // ... renders quote details
}
```

**Vulnerability:**
- Server component has **NO authentication check**
- Anyone can access quote details by URL
- Shows full quote history, pricing, client info

**Exploit Scenario:**
1. Attacker guesses/enumerates quote IDs
2. Accesses competitor quotes directly via URL
3. Views all pricing, client names, project details

**Business Impact:**
- Complete data breach
- Competitive intelligence theft

**Fix Required:**
```typescript
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  // ADD AUTHENTICATION CHECK
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { user: true }
  });

  if (!quote) {
    notFound();
  }

  // ADD AUTHORIZATION CHECK
  if (quote.userId !== user.id) {
    notFound(); // Don't reveal quote exists
  }

  // ... rest of code
}
```

**Severity:** 🔴 **CRITICAL**

---

### 7. HIGH: Public Rate Cards Endpoint Exposes Pricing

**Location:** `server/api/routers/rate-cards.ts:21-40`

**Code:**
```typescript
list: publicProcedure.query(async ({ ctx }) => {
  return ctx.prisma.rateCard.findMany({
    include: { bands: true }  // ⚠️ EXPOSES ALL PRICING
  });
})
```

**Vulnerability:**
- Rate cards are **public** (no authentication required)
- Exposes complete pricing structure
- Competitors can see all pricing bands

**Exploit Scenario:**
1. Attacker accesses `/api/trpc/rateCards.list`
2. Gets all rate cards and pricing bands
3. Uses information for competitive pricing

**Business Impact:**
- Pricing strategy exposure
- Competitive disadvantage

**Fix Required:**
```typescript
list: protectedProcedure.query(async ({ ctx }) => {
  // Now requires authentication
  return ctx.prisma.rateCard.findMany({
    include: { bands: true }
  });
})
```

**Severity:** 🟠 **HIGH**

---

### 8. HIGH: SSRF Vulnerability in PDF Generation

**Location:** `server/pdf/generator.tsx:40-42`

**Code:**
```typescript
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const pdfUrl = `${siteUrl}/quotes/${quoteId}/pdf`;  // ⚠️ USER-CONTROLLED INPUT

await page.goto(pdfUrl, { waitUntil: 'networkidle0' });  // ⚠️ SSRF RISK
```

**Vulnerability:**
- Puppeteer navigates to URL constructed from user input (`quoteId`)
- If `NEXT_PUBLIC_SITE_URL` can be manipulated, SSRF attack possible
- Could access internal services, localhost endpoints

**Exploit Scenario:**
1. Attacker manipulates `NEXT_PUBLIC_SITE_URL` (if exposed)
2. Sets to `http://169.254.169.254` (AWS metadata)
3. Puppeteer fetches internal AWS credentials
4. Complete cloud account compromise

**Business Impact:**
- Cloud account compromise
- Internal network access
- Data exfiltration

**Fix Required:**
```typescript
// Validate site URL is safe
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const url = new URL(siteUrl);

// Prevent SSRF - only allow http/https, block internal IPs
if (!['http:', 'https:'].includes(url.protocol)) {
  throw new Error('Invalid protocol');
}

// Block internal IP ranges
const hostname = url.hostname;
if (hostname === 'localhost' || 
    hostname.startsWith('127.') || 
    hostname.startsWith('169.254.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.')) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Internal URLs not allowed in production');
  }
}

const pdfUrl = `${siteUrl}/quotes/${quoteId}/pdf`;
```

**Severity:** 🟠 **HIGH**

---

### 9. HIGH: CSV Import DoS - No File Size Limits

**Location:** `server/api/routers/import.ts:31-52`

**Code:**
```typescript
preview: protectedProcedure
  .input(z.object({ csv: z.string().min(1) }))  // ⚠️ NO MAX LENGTH
  .mutation(async ({ input }) => {
    const rows = parseCsv(input.csv);  // ⚠️ NO SIZE LIMIT
```

**Vulnerability:**
- No maximum file size limit
- Large CSV could exhaust memory
- PapaParse could process gigabytes of data
- Server could crash or hang

**Exploit Scenario:**
1. Attacker creates 10GB CSV file
2. Uploads via import endpoint
3. Server runs out of memory
4. Denial of service

**Business Impact:**
- Service outage
- Resource exhaustion
- Cost spike (if serverless)

**Fix Required:**
```typescript
const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10MB

preview: protectedProcedure
  .input(z.object({ 
    csv: z.string()
      .min(1)
      .max(MAX_CSV_SIZE, 'CSV file too large (max 10MB)')
  }))
  .mutation(async ({ input }) => {
    // Add row count limit
    const parsed = Papa.parse(input.csv, {
      header: true,
      skipEmptyLines: true
    });

    if (parsed.data.length > 10000) {
      throw new Error('CSV contains too many rows (max 10,000)');
    }

    const rows = parsed.data.map((row) => csvRowSchema.parse(row));
    // ... rest
  })
```

**Severity:** 🟠 **HIGH**

---

### 10. HIGH: Missing Rate Limiting

**Location:** All tRPC endpoints

**Vulnerability:**
- No rate limiting on any endpoints
- Attacker can:
  - Spam PDF generation (expensive Puppeteer operations)
  - Enumerate quote IDs rapidly
  - Overwhelm database with queries
  - Cause cost spikes

**Exploit Scenario:**
1. Attacker scripts rapid requests to `generatePdf`
2. Each request spawns Puppeteer instance
3. Server exhausts memory/CPU
4. Service becomes unavailable

**Business Impact:**
- Service outage
- Cost explosion (serverless)
- Poor user experience

**Fix Required:**
```typescript
// Add rate limiting middleware
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

export const protectedProcedure = t.procedure
  .use(async ({ ctx, next }) => {
    // Rate limit check
    const { success } = await ratelimit.limit(ctx.user.id);
    if (!success) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }
    
    // Existing auth check
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    
    return next({ ctx });
  });
```

**Severity:** 🟠 **HIGH**

---

### 11. MEDIUM: Weak Input Validation - VAT Rate

**Location:** `server/api/routers/quotes.ts:46`

**Code:**
```typescript
vatRate: z.number().min(0),  // ⚠️ NO MAX, ALLOWS 999999
```

**Vulnerability:**
- VAT rate can be set to any positive number
- No maximum limit (e.g., 100)
- Could create quotes with incorrect VAT calculations

**Exploit Scenario:**
1. Attacker creates quote with `vatRate: 999999`
2. Quote total becomes astronomical
3. Could be used for fraud or to crash display

**Business Impact:**
- Incorrect financial calculations
- Display bugs
- Potential fraud

**Fix Required:**
```typescript
vatRate: z.number().min(0).max(100, 'VAT rate cannot exceed 100%'),
```

**Severity:** 🟡 **MEDIUM**

---

### 12. MEDIUM: Missing Validation - Quantity Limits

**Location:** `server/api/routers/quotes.ts:43`

**Code:**
```typescript
quantity: z.number().int().positive(),  // ⚠️ NO MAX LIMIT
```

**Vulnerability:**
- Quantity can be set to `Number.MAX_SAFE_INTEGER`
- Could cause:
  - Integer overflow in calculations
  - Memory issues
  - Display problems

**Exploit Scenario:**
1. Attacker sets quantity to `9007199254740991` (max safe integer)
2. Calculations could overflow
3. System crashes or produces incorrect results

**Business Impact:**
- Calculation errors
- System instability

**Fix Required:**
```typescript
quantity: z.number().int().positive().max(1000000000, 'Quantity too large'),
```

**Severity:** 🟡 **MEDIUM**

---

### 13. MEDIUM: No File Type Validation on CSV Import

**Location:** `server/api/routers/import.ts:64`

**Code:**
```typescript
await uploadsBucket.upload(`/${input.fileName}`, Buffer.from(input.csv, 'utf-8'), {
  contentType: 'text/csv',  // ⚠️ TRUSTS CLIENT INPUT
  upsert: true
});
```

**Vulnerability:**
- File name comes from user input
- No validation of file extension
- Could upload malicious files with `.csv` extension but binary content

**Exploit Scenario:**
1. Attacker uploads file named `malware.csv` containing executable code
2. File stored in Supabase storage
3. If later downloaded/executed, could cause harm

**Business Impact:**
- Malware storage
- Potential code execution

**Fix Required:**
```typescript
// Validate file name
const fileName = input.fileName.trim();
if (!fileName.endsWith('.csv')) {
  throw new Error('File must have .csv extension');
}

// Sanitize file name (prevent path traversal)
const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

await uploadsBucket.upload(`/${sanitized}`, Buffer.from(input.csv, 'utf-8'), {
  contentType: 'text/csv',
  upsert: false // Don't allow overwriting existing files
});
```

**Severity:** 🟡 **MEDIUM**

---

### 14. MEDIUM: Service Role Key Not Used for Storage

**Location:** `server/api/routers/quotes.ts:351`

**Code:**
```typescript
const storage = ctx.supabase.storage.from('quotes');  // ⚠️ USES ANON KEY
```

**Vulnerability:**
- Uses Supabase client with anon key
- Should use service role key for server-side operations
- Anon key has restrictions; service role key bypasses RLS

**Impact:**
- May fail if RLS policies are too restrictive
- Not following best practices

**Fix Required:**
```typescript
import { createClient } from '@supabase/supabase-js';

const serviceRoleClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const storage = serviceRoleClient.storage.from('quotes');
```

**Severity:** 🟡 **MEDIUM**

---

### 15. LOW: Information Disclosure in Error Messages

**Location:** Multiple files

**Vulnerability:**
- Error messages reveal internal details:
  - `Rate card ${line.rateCardId} not found` - reveals valid IDs
  - `No band for ${card.name} at quantity ${input.quantity}` - reveals internal structure

**Exploit Scenario:**
1. Attacker probes with invalid IDs
2. Error messages reveal valid IDs or structure
3. Helps enumeration attacks

**Business Impact:**
- Information leakage
- Aids attackers

**Fix Required:**
```typescript
// Generic error messages
throw new Error('Rate card not found'); // Don't reveal ID
throw new Error('Invalid pricing configuration'); // Don't reveal details
```

**Severity:** 🔵 **LOW**

---

## SUMMARY OF FINDINGS

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 6 | **BLOCK DEPLOYMENT** |
| 🟠 HIGH | 4 | **FIX BEFORE DEPLOYMENT** |
| 🟡 MEDIUM | 4 | Fix soon |
| 🔵 LOW | 1 | Nice to have |

---

## IMMEDIATE ACTION REQUIRED

### Before ANY Production Deployment:

1. ✅ **Remove demo user fallback** - Require real authentication
2. ✅ **Add authorization checks** - Verify quote ownership on ALL operations
3. ✅ **Protect page routes** - Add auth middleware to Next.js pages
4. ✅ **Add rate limiting** - Prevent abuse
5. ✅ **Fix SSRF vulnerability** - Validate URLs in PDF generation
6. ✅ **Add input validation** - File size limits, value ranges

### Deployment Checklist:

- [ ] All CRITICAL issues fixed
- [ ] All HIGH issues fixed
- [ ] Security testing completed
- [ ] Penetration testing passed
- [ ] Code review completed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring/alerts configured

---

## RECOMMENDED SECURITY IMPROVEMENTS

1. **Implement Row Level Security (RLS)** in Supabase
2. **Add CSP headers** for XSS protection
3. **Implement audit logging** for all sensitive operations
4. **Add request signing** for critical operations
5. **Implement session timeout** and refresh
6. **Add 2FA** for admin users
7. **Implement IP allowlisting** for admin operations
8. **Add security.txt** file for responsible disclosure

---

**AUDIT COMPLETE**

**Status:** 🔴 **NOT PRODUCTION READY**

**Estimated Fix Time:** 2-3 days for critical issues

**Next Steps:** Fix all CRITICAL issues, then re-audit.

