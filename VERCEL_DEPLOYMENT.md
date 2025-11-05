# 🚀 Vercel Deployment Guide

Complete guide for deploying PrintWorks Estimator to Vercel.

## 📋 Pre-Deployment Checklist

- [ ] Supabase database is set up and migrations are applied
- [ ] Supabase Storage buckets (`quotes` and `imports`) are created
- [ ] Resend account is set up (optional but recommended)
- [ ] Domain is verified in Resend (if using custom domain)

## 🔧 Step 1: Environment Variables

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add:

### Required Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Critical for PDF generation and storage
SUPABASE_DB_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Application URL (CRITICAL - must match your Vercel deployment URL)
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

### Optional Variables (Recommended)

```bash
# Resend Email Configuration
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com  # Must be verified domain

# Upstash Redis (for rate limiting - optional)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXX...
```

**Important Notes:**
- `NEXT_PUBLIC_SITE_URL` must be set to your **actual Vercel deployment URL** (e.g., `https://printworks-estimator.vercel.app`)
- After first deployment, Vercel will show you the URL - update this variable and redeploy
- Without `SUPABASE_SERVICE_ROLE_KEY`, PDF generation and storage uploads will fail
- For email, verify your domain in Resend dashboard first

## 🏗️ Step 2: Build Configuration

The project is already configured with `vercel.json`:

- **Build Command**: `prisma generate && next build` (automatically runs Prisma generate)
- **Function Timeout**: 60 seconds for PDF generation routes
- **Memory**: 3008 MB for PDF generation functions

No additional configuration needed!

## 📦 Step 3: Deploy to Vercel

### Option A: Deploy via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Deploy to production
vercel --prod
```

### Option B: Deploy via GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will auto-detect Next.js settings
6. Add environment variables in the dashboard
7. Click "Deploy"

## ✅ Step 4: Post-Deployment Verification

### 1. Check Build Logs

After deployment, check the build logs for:
- ✅ Prisma generate completed successfully
- ✅ Next.js build completed
- ✅ No environment variable errors

### 2. Test the Application

1. **Visit your deployment URL**: `https://your-app.vercel.app`
2. **Test login**: Should redirect to Supabase auth
3. **Create a test quote**: Verify database connection works
4. **Generate PDF**: Click "Generate PDF" button
   - Should generate PDF successfully
   - Check Vercel function logs for any errors

### 3. Verify PDF Generation

The PDF generation uses `@sparticuz/chromium` automatically in production:

- ✅ No Chrome executable path needed
- ✅ Works out of the box on Vercel
- ✅ Function timeout: 60 seconds
- ✅ Memory: 3008 MB

**Check Function Logs:**
```
Vercel Dashboard → Your Project → Functions → /api/quotes/[id]/issue
```

Look for:
- `[PDF] Starting PDF generation for quote: ...`
- `[PDF] ✓ PDF generated successfully`
- `[Issue] PDF uploaded, URL: ...`

### 4. Test Email Functionality (if configured)

1. Open a quote
2. Click "Send Email"
3. Enter an email address
4. Check function logs for email sending status
5. Verify email arrives in inbox

## 🔍 Troubleshooting

### PDF Generation Fails

**Error: "Chrome executable not found"**
- ✅ Fixed: Production uses `@sparticuz/chromium` automatically
- No action needed

**Error: "Function timeout"**
- Check Vercel function logs for slow operations
- PDF generation should complete in < 30 seconds
- If timing out, check `NEXT_PUBLIC_SITE_URL` is correct

**Error: "Page appears to be empty"**
- Verify `NEXT_PUBLIC_SITE_URL` matches your Vercel deployment URL exactly
- Check `/quotes/[id]/print` route is accessible
- Look for errors in function logs

### Database Connection Issues

**Error: "Can't reach database server"**
- Verify `SUPABASE_DB_URL` is correct
- Check Supabase dashboard for connection status
- Ensure IP allowlist includes Vercel IPs (if enabled)

### Storage Upload Fails

**Error: "Storage upload failed"**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check Supabase Storage bucket `quotes` exists
- Verify bucket permissions allow uploads

### Environment Variables Not Loading

**Issue: Variables show as undefined**
- Variables must be added in Vercel dashboard (not just `.env.local`)
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

### Build Fails

**Error: "Prisma generate failed"**
- ✅ Fixed: Build command includes `prisma generate`
- If still failing, check `DATABASE_URL` is accessible from build environment
- Vercel may need network access to Supabase during build

## 📊 Monitoring

### Vercel Function Logs

Monitor PDF generation:
```
Vercel Dashboard → Your Project → Functions → /api/quotes/[id]/issue
```

Look for:
- Execution time (should be < 30 seconds)
- Memory usage (should be < 3008 MB)
- Error rates

### Supabase Dashboard

Monitor:
- Database connection pool usage
- Storage bucket usage
- API request rates

## 🔒 Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (never exposed to client)
- [ ] `NEXT_PUBLIC_SITE_URL` points to production domain
- [ ] Supabase RLS policies are enabled
- [ ] Storage buckets are private (not public)
- [ ] Resend domain is verified (if using email)

## 🎯 Quick Reference

**Key URLs:**
- Production: `https://your-app.vercel.app`
- Print Route: `https://your-app.vercel.app/quotes/[id]/print`
- Issue API: `https://your-app.vercel.app/api/quotes/[id]/issue`

**Function Configuration:**
- Timeout: 60 seconds
- Memory: 3008 MB
- Runtime: Node.js 18+ (auto-detected)

**Dependencies:**
- `@sparticuz/chromium` - Already installed for Vercel
- `puppeteer-core` - Already installed
- All dependencies configured correctly

## ✨ Next Steps

After successful deployment:

1. **Set up custom domain** (optional):
   - Vercel Dashboard → Settings → Domains
   - Add your domain
   - Update `NEXT_PUBLIC_SITE_URL` to match

2. **Configure monitoring**:
   - Set up Vercel analytics
   - Configure error tracking (Sentry, etc.)

3. **Set up backups**:
   - Configure Supabase database backups
   - Regular storage bucket backups

---

**Need Help?** Check Vercel function logs and Supabase dashboard for detailed error messages.

