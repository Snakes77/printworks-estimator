# Minimal RLS Policies

**Note:** Keep RLS off during initial testing to avoid false failures.

## Minimal Policies to Enable Later

### Quotes Table

```sql
-- Users can only view quotes they own
CREATE POLICY "Users can view own quotes"
  ON "Quote" FOR SELECT
  USING (auth.uid()::text = "userId");

-- Users can insert quotes for themselves
CREATE POLICY "Users can create own quotes"
  ON "Quote" FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

-- Users can update quotes they own
CREATE POLICY "Users can update own quotes"
  ON "Quote" FOR UPDATE
  USING (auth.uid()::text = "userId");
```

### Audit Events (QuoteHistory)

```sql
-- Users can view audit events for quotes they own
CREATE POLICY "Users can view own audit events"
  ON "QuoteHistory" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteHistory"."quoteId"
      AND "Quote"."userId" = auth.uid()::text
    )
  );

-- Audit events are created by the application (via service role)
-- No INSERT policy needed for users
```

## Storage Bucket

The `quotes` bucket should be **public** initially. To switch to signed URLs later:

1. Set bucket to private in Supabase Dashboard
2. Use `storage.createSignedUrl(filePath, 3600)` instead of `getPublicUrl()`
3. Add RLS policy for storage access (see `prisma/rls-policies.sql`)

