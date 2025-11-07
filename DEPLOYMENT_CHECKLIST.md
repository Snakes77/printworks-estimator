# Deployment Checklist - Feature Flag System

## ✅ Pre-Deployment: Set Flag OFF

### For Local Development (.env.local)

```bash
# Create or update .env.local
echo "ENABLE_CATEGORY_SYSTEM=false" >> .env.local
```

### For Production (Vercel)

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update:
   - **Name:** `ENABLE_CATEGORY_SYSTEM`
   - **Value:** `false`
   - **Environment:** Production, Preview, Development (all)
3. Save

**OR** use Vercel CLI:

```bash
vercel env add ENABLE_CATEGORY_SYSTEM production
# When prompted, enter: false
```

## 🚀 Deploy to Production

```bash
# Commit any changes
git add .
git commit -m "Add feature flag system for category rollout"

# Push to main
git push origin main
```

Vercel will automatically deploy.

## ✅ Post-Deployment Verification

### 1. Check Feature Flag Status

```bash
# In production
curl https://your-app.vercel.app/api/admin/feature-flags
```

Should show:
```json
{
  "flags": {
    "CATEGORY_SYSTEM": {
      "value": "false",
      "enabled": false
    }
  }
}
```

### 2. Test Old System Still Works

- Create a new quote
- Verify calculations work correctly
- Check that totals display properly
- No errors in console

### 3. Verify No Breaking Changes

- Existing quotes load correctly
- Quote list works
- PDF generation works (if applicable)
- All existing functionality intact

## 📝 Notes

- **Flag is OFF:** Old system (V1) is active
- **No database changes yet:** Migration comes later
- **Safe deployment:** New code is deployed but disabled
- **Zero risk:** Old system continues working exactly as before

## 🔄 Next Steps (Later This Week)

1. Run Prisma migration for category system
2. Categorize rate cards
3. Backfill existing data
4. Test new system in development
5. Gradually enable flag: `10` → `50` → `true`

## 🆘 Rollback Plan

If anything breaks (unlikely with flag OFF):

1. **Instant rollback:** Change `ENABLE_CATEGORY_SYSTEM=false` in Vercel
2. **Or revert code:** `git revert HEAD` and push

---

**Status:** ✅ Ready to deploy with flag OFF
