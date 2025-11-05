# 🚀 PRODUCTION DEPLOYMENT CHECKLIST

Complete this checklist before deploying to production.

## ✅ Step 1: Supabase RLS Policies (5 minutes)

**Action Required:**
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `prisma/rls-policies.sql`
3. Execute the SQL script
4. Verify policies are active:
   - Supabase Dashboard → Authentication → Policies
   - Should see policies for Quote, QuoteHistory, RateCard tables

**Verification:**
```sql
-- Run this in Supabase SQL Editor to verify:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('Quote', 'QuoteHistory', 'RateCard');
-- Should show rowsecurity = true for all tables
```

---

## ✅ Step 2: Secure Storage Buckets (2 minutes)

**Action Required:**
1. Supabase Dashboard → Storage
2. **For "quotes" bucket:**
   - Click the bucket → Configuration tab
   - Set "Public bucket" to **OFF** (private)
   - Save
3. **For "imports" bucket:**
   - Click the bucket → Configuration tab
   - Set "Public bucket" to **OFF** (private)
   - Save

**Verification:**
- Try accessing a PDF URL directly → Should fail with "Access Denied"
- After deployment, PDFs will use signed URLs instead

---

## ✅ Step 3: Environment Variables (5 minutes)

**Required in Vercel Dashboard → Settings → Environment Variables:**

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # CRITICAL - needed for signed URLs
SUPABASE_DB_URL=postgresql://...

# Site URL (Required)
NEXT_PUBLIC_SITE_URL=https://your-production-domain.vercel.app

# Upstash Redis (Optional but Recommended)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXX...
```

**Getting Upstash Credentials:**
1. Go to https://upstash.com (free tier works)
2. Create new Redis database
3. Copy REST URL and Token
4. Add to Vercel environment variables

**Note:** Rate limiting will work without Upstash (uses in-memory), but for production with multiple instances, Upstash is recommended.

---

## ✅ Step 4: Manual Security Test (10 minutes)

### Test 1: Authentication
- [ ] Visit `/dashboard` without login → Should redirect to `/login`
- [ ] Visit `/quotes` without login → Should redirect to `/login`
- [ ] Visit `/rate-cards` without login → Should redirect to `/login`

### Test 2: Authorization (Cross-User Access)
**Browser 1 (User A):**
- [ ] Sign up / login as `testuser1@example.com`
- [ ] Create a quote, note the quote ID
- [ ] Generate a PDF, copy the download URL

**Browser 2 (User B):**
- [ ] Sign up / login as `testuser2@example.com`
- [ ] Try to access User A's quote: `/quotes/{user-a-quote-id}` → Should show 404 or redirect
- [ ] Try to use User A's PDF URL → Should fail (bucket is private)

### Test 3: Rate Limiting
- [ ] Generate 11 PDFs rapidly → 11th request should return 429 Too Many Requests
- [ ] Try CSV import 6 times in an hour → 6th should be rate-limited

### Test 4: Input Validation
- [ ] Try to create quote with VAT = 150% → Should show validation error
- [ ] Try to create quote with quantity = 10,000,000,000 → Should show validation error
- [ ] Try to upload CSV > 10MB → Should show file size error

---

## ✅ Step 5: Deploy to Production

```bash
# From your local machine:

git add .
git commit -m "fix: Critical security hardening - 6 zero-days patched

- Removed demo user authentication bypass
- Added authorization checks to all quote operations
- Implemented RLS policies on Supabase
- Protected PDF generation with ownership verification
- Added rate limiting on expensive operations
- Validated all user inputs with strict schemas
- Converted storage buckets to private with signed URLs

BREAKING CHANGE: All API routes now require authentication."

git push origin main

# Vercel will auto-deploy
# Monitor deployment logs for any errors
```

---

## ✅ Step 6: Post-Deployment Verification

After deployment completes:

1. **Check Vercel Deployment Logs:**
   - [ ] Build completed successfully
   - [ ] No TypeScript errors
   - [ ] Environment variables loaded correctly

2. **Test Production Site:**
   - [ ] Can login successfully
   - [ ] Can create quotes
   - [ ] PDF generation works
   - [ ] No console errors in browser devtools

3. **Monitor:**
   - [ ] Supabase Dashboard → Check for failed auth attempts
   - [ ] Upstash Dashboard → Check rate limit usage (if configured)
   - [ ] Vercel Analytics → Monitor error rates

---

## 🚨 Critical: DO NOT SKIP

- [ ] **RLS policies applied** - Without this, database is still vulnerable
- [ ] **Buckets set to private** - Without this, PDFs are still public
- [ ] **Manual testing completed** - Prove cross-user access is blocked

---

## 📊 Success Criteria

Before deployment:
- ✅ All checklist items completed
- ✅ Manual security tests passed
- ✅ No TypeScript errors
- ✅ Environment variables configured

After deployment:
- ✅ Users can only access their own quotes
- ✅ PDFs require authentication and expire after 5 minutes
- ✅ Rate limiting prevents abuse
- ✅ No unauthorized access possible

---

## 🆘 Troubleshooting

**Issue:** "Failed to generate signed URL"
- **Solution:** Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Vercel

**Issue:** "Rate limit not working"
- **Solution:** Check `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set (or use in-memory fallback)

**Issue:** "Users can still access other users' quotes"
- **Solution:** Verify RLS policies were applied correctly in Supabase SQL Editor

**Issue:** "PDF URLs don't expire"
- **Solution:** Verify buckets are set to private and code is using `createSignedUrl()`

---

**Estimated Time:** 20-30 minutes total  
**Risk Level:** Low (after completing checklist)  
**Status:** ✅ Ready for production deployment

