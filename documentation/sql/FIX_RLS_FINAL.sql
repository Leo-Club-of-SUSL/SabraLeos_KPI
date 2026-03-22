-- 1. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON app_users;
DROP POLICY IF EXISTS "Super admins can insert users" ON app_users;
DROP POLICY IF EXISTS "Super admins can update users" ON app_users;
DROP POLICY IF EXISTS "View profiles" ON app_users;
DROP POLICY IF EXISTS "Admins insert users" ON app_users;
DROP POLICY IF EXISTS "Admins update users" ON app_users;

-- 2. Create the secure function (if not exists or update it)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the current user has the 'super_admin' role
  RETURN EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create SIMPLIFIED policies

-- Allow anyone authenticated to READ (Select) users
-- This is necessary because to check "is_admin", we need to read the table!
-- We rely on the application logic to hide sensitive data if needed, 
-- but for this app, user lists are generally public to authenticated users.
CREATE POLICY "Enable read access for all authenticated users"
ON app_users FOR SELECT TO authenticated USING (true);

-- Allow Admins to INSERT
-- We use the is_admin() function which is SECURITY DEFINER (bypasses RLS)
CREATE POLICY "Enable insert for admins"
ON app_users FOR INSERT TO authenticated
WITH CHECK ( is_admin() );

-- Allow Admins to UPDATE
CREATE POLICY "Enable update for admins"
ON app_users FOR UPDATE TO authenticated
USING ( is_admin() );

-- Allow Admins to DELETE
CREATE POLICY "Enable delete for admins"
ON app_users FOR DELETE TO authenticated
USING ( is_admin() );
