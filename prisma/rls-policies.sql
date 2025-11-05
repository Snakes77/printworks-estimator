-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Run these SQL commands in Supabase SQL Editor to enable RLS
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuoteHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateCard" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own quotes" ON "Quote";
DROP POLICY IF EXISTS "Users can insert own quotes" ON "Quote";
DROP POLICY IF EXISTS "Users can update own quotes" ON "Quote";
DROP POLICY IF EXISTS "Users can delete own quotes" ON "Quote";
DROP POLICY IF EXISTS "Users can view own quote history" ON "QuoteHistory";
DROP POLICY IF EXISTS "Authenticated users can view rate cards" ON "RateCard";

-- ============================================================================
-- QUOTE POLICIES
-- ============================================================================

-- Users can only SELECT their own quotes
CREATE POLICY "Users can view own quotes"
  ON "Quote" FOR SELECT
  USING (auth.uid()::text = "userId");

-- Users can only INSERT quotes with their own userId
CREATE POLICY "Users can insert own quotes"
  ON "Quote" FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

-- Users can only UPDATE their own quotes
CREATE POLICY "Users can update own quotes"
  ON "Quote" FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

-- Users can only DELETE their own quotes
CREATE POLICY "Users can delete own quotes"
  ON "Quote" FOR DELETE
  USING (auth.uid()::text = "userId");

-- ============================================================================
-- QUOTE HISTORY POLICIES
-- ============================================================================

-- Users can only view history for quotes they own
CREATE POLICY "Users can view own quote history"
  ON "QuoteHistory" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteHistory"."quoteId"
      AND "Quote"."userId" = auth.uid()::text
    )
  );

-- History is created automatically by the application (via service role)
-- No INSERT policy needed for users

-- ============================================================================
-- RATE CARD POLICIES
-- ============================================================================

-- Authenticated users can view rate cards (read-only for most users)
CREATE POLICY "Authenticated users can view rate cards"
  ON "RateCard" FOR SELECT
  TO authenticated
  USING (true);

-- Rate cards are managed by admins (via service role)
-- No INSERT/UPDATE/DELETE policies for regular users

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================
-- Run these AFTER setting buckets to PRIVATE in Supabase Dashboard

-- Users can view PDFs only for quotes they own
CREATE POLICY "Users can view own PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'quotes' 
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM "Quote" WHERE "userId" = auth.uid()::text
    )
  );

-- PDFs are uploaded by the application (via service role)
-- No INSERT policy needed for users

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('Quote', 'QuoteHistory', 'RateCard');

-- Should show rowsecurity = true for all tables

