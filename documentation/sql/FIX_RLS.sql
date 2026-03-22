-- 1. Create a secure function to check admin status bypassing RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update app_users policies to use the new function
DROP POLICY IF EXISTS "Users can view their own profile" ON app_users;
DROP POLICY IF EXISTS "Super admins can insert users" ON app_users;
DROP POLICY IF EXISTS "Super admins can update users" ON app_users;

-- Allow users to view their own profile, AND allow admins to view ALL profiles
CREATE POLICY "View profiles"
  ON app_users FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_admin()
  );

-- Allow only admins to insert new users
CREATE POLICY "Admins insert users"
  ON app_users FOR INSERT TO authenticated
  WITH CHECK ( is_admin() );

-- Allow only admins to update users
CREATE POLICY "Admins update users"
  ON app_users FOR UPDATE TO authenticated
  USING ( is_admin() );
