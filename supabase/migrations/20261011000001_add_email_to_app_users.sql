-- Migration: 20261011000001_add_email_to_app_users.sql
-- Description:
--   1. Add email column to public.app_users
--   2. Backfill existing emails from auth.users and public.members
--   3. Create public.get_all_users() RPC returning complete profile with email for officers
--   4. Sync auth.users email changes to app_users

-- 1. Add email column to app_users
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;

-- 2. Backfill from auth.users
UPDATE public.app_users u
SET email = lower(trim(a.email))
FROM auth.users a
WHERE u.id = a.id AND a.email IS NOT NULL AND (u.email IS NULL OR u.email = '');

-- 3. Backfill remaining linked members from public.members
UPDATE public.app_users u
SET email = lower(trim(m.email))
FROM public.members m
WHERE u.linked_member_reg_no = m.reg_no AND m.email IS NOT NULL AND (u.email IS NULL OR u.email = '');

-- 4. RPC: get_all_users()
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  designation TEXT,
  role TEXT,
  status TEXT,
  linked_member_reg_no TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.is_officer()) THEN
    RAISE EXCEPTION 'Access denied: officer role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.username,
    COALESCE(u.email, a.email, m.email)::TEXT AS email,
    u.designation,
    u.role,
    u.status,
    u.linked_member_reg_no,
    u.created_at
  FROM public.app_users u
  LEFT JOIN auth.users a ON a.id = u.id
  LEFT JOIN public.members m ON m.reg_no = u.linked_member_reg_no
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_users() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_all_users() TO authenticated;

-- 5. Trigger to automatically keep app_users.email synced on auth.users email update
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.app_users
  SET email = lower(trim(NEW.email))
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_email_sync ON auth.users;
CREATE TRIGGER trg_auth_user_email_sync
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_email_sync();
