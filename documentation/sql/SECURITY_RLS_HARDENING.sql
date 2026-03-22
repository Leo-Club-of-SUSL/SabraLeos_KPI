-- ============================================================
-- SECURITY HARDENING: Tighter RLS for app_users
-- ============================================================
-- Run this in Supabase SQL Editor to restrict app_users access.
-- After running, only admins can see all user records.
-- Regular users can only see their own profile.
-- ============================================================

-- 1. Drop the overly-permissive SELECT policy
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON app_users;

-- 2. Create a tighter SELECT policy: own profile + admins see all
CREATE POLICY "View own profile or admin sees all"
  ON app_users FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_admin()
  );

-- 3. Ensure the remaining policies exist (idempotent)
-- These should already be in place from FIX_RLS_FINAL.sql but
-- including them here for completeness.

DROP POLICY IF EXISTS "Enable insert for admins" ON app_users;
CREATE POLICY "Enable insert for admins"
  ON app_users FOR INSERT TO authenticated
  WITH CHECK ( is_admin() );

DROP POLICY IF EXISTS "Enable update for admins" ON app_users;
CREATE POLICY "Enable update for admins"
  ON app_users FOR UPDATE TO authenticated
  USING ( is_admin() );

DROP POLICY IF EXISTS "Enable delete for admins" ON app_users;
CREATE POLICY "Enable delete for admins"
  ON app_users FOR DELETE TO authenticated
  USING ( is_admin() );

-- ============================================================
-- VERIFICATION: After running, test with a non-admin user.
-- They should only see their own row in app_users.
-- ============================================================
