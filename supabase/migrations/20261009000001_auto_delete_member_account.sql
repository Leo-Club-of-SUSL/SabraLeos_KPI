-- ============================================================
-- Migration: 20261009000001_auto_delete_member_account.sql
-- Description: Automatically delete member login accounts from
--              auth.users and app_users when a member is soft-deleted
--              or permanently deleted. Cleans up existing orphaned accounts
--              and ensures logging foreign keys allow ON DELETE SET NULL.
-- ============================================================

-- 1. Ensure all logging and related tables have ON DELETE SET NULL on auth.users references
--    so user deletion does not trigger foreign key constraint violations (SQLSTATE 23503)
ALTER TABLE IF EXISTS public.system_logs
  DROP CONSTRAINT IF EXISTS system_logs_user_id_fkey;

ALTER TABLE IF EXISTS public.system_logs
  ADD CONSTRAINT system_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.security_events
  DROP CONSTRAINT IF EXISTS security_events_user_id_fkey,
  DROP CONSTRAINT IF EXISTS security_events_actor_id_fkey;

ALTER TABLE IF EXISTS public.security_events
  ADD CONSTRAINT security_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.security_events
  ADD CONSTRAINT security_events_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.contributions
  DROP CONSTRAINT IF EXISTS contributions_added_by_fkey;

ALTER TABLE IF EXISTS public.contributions
  ADD CONSTRAINT contributions_added_by_fkey
  FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.system_settings
  DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;

ALTER TABLE IF EXISTS public.system_settings
  ADD CONSTRAINT system_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Trigger function to automatically delete member accounts when member is deleted
CREATE OR REPLACE FUNCTION public.handle_member_account_auto_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_reg_no TEXT;
  v_user_record RECORD;
BEGIN
  -- Determine registration number based on operation
  IF TG_OP = 'DELETE' THEN
    v_reg_no := OLD.reg_no;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only trigger if member is transitioning from active to soft-deleted
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_reg_no := NEW.reg_no;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_reg_no IS NULL OR TRIM(v_reg_no) = '' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Find all accounts linked to this member registration number
  FOR v_user_record IN (
    SELECT id, role
    FROM public.app_users
    WHERE UPPER(TRIM(linked_member_reg_no)) = UPPER(TRIM(v_reg_no))
       OR UPPER(TRIM(username)) = UPPER(TRIM(v_reg_no))
  ) LOOP
    -- If user is an officer (super_admin or editor), do NOT delete their auth account.
    -- Instead, simply unlink them from the deleted member so their officer access is preserved.
    IF v_user_record.role IN ('super_admin', 'editor') THEN
      UPDATE public.app_users
      SET linked_member_reg_no = NULL
      WHERE id = v_user_record.id;
    ELSE
      -- Member account: permanently delete from auth.users (cascades to app_users)
      DELETE FROM auth.users WHERE id = v_user_record.id;
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 3. Attach trigger to public.members (BEFORE DELETE and AFTER UPDATE OF deleted_at)
DROP TRIGGER IF EXISTS trg_member_account_auto_delete_delete ON public.members;
CREATE TRIGGER trg_member_account_auto_delete_delete
  BEFORE DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_account_auto_delete();

DROP TRIGGER IF EXISTS trg_member_account_auto_delete_soft ON public.members;
CREATE TRIGGER trg_member_account_auto_delete_soft
  AFTER UPDATE OF deleted_at ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_account_auto_delete();

-- 4. One-time cleanup of existing orphaned member accounts
-- Delete member accounts whose linked member has already been soft-deleted
DELETE FROM auth.users
WHERE id IN (
  SELECT u.id
  FROM public.app_users u
  JOIN public.members m ON UPPER(TRIM(u.linked_member_reg_no)) = UPPER(TRIM(m.reg_no))
  WHERE m.deleted_at IS NOT NULL
    AND u.role = 'member'
);

-- Delete member accounts whose linked member no longer exists in members table
DELETE FROM auth.users
WHERE id IN (
  SELECT u.id
  FROM public.app_users u
  WHERE u.role = 'member'
    AND u.linked_member_reg_no IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.members m
      WHERE UPPER(TRIM(m.reg_no)) = UPPER(TRIM(u.linked_member_reg_no))
    )
);

-- Unlink officer accounts that point to soft-deleted or non-existent members
UPDATE public.app_users u
SET linked_member_reg_no = NULL
WHERE u.role IN ('super_admin', 'editor')
  AND u.linked_member_reg_no IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE UPPER(TRIM(m.reg_no)) = UPPER(TRIM(u.linked_member_reg_no))
      AND m.deleted_at IS NULL
  );
