-- ============================================================
-- Migration: 20261005000001_security_hardening.sql
-- Phase 1 — Security Hardening (Nexus KPI / SabraLeos)
-- ============================================================
-- ROLLBACK NOTE: A companion rollback script is at the end of
-- this file inside the ROLLBACK PLAN comment block. Apply it
-- manually in reverse order if you need to revert.
-- ============================================================
-- PREREQUISITE: Take a full database backup before running.
-- Apply to staging first; verify with the smoke-test queries at
-- the bottom before applying to production.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SCHEMA ADDITIONS
-- ============================================================

-- 1a. app_users.status — used to suspend accounts without deleting auth rows.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended'));

-- 1b. members soft-delete
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 1c. members — additional Phase 2 columns (non-breaking additions; nullable)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS leaderboard_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_alias TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS member_status TEXT NOT NULL DEFAULT 'active'
    CHECK (member_status IN ('active', 'alumni'));

-- Unique index on lower(email) — partial, ignores NULLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_unique
  ON public.members (lower(email))
  WHERE email IS NOT NULL;

-- Email format CHECK
ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_email_format_check;
ALTER TABLE public.members
  ADD CONSTRAINT members_email_format_check
  CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- 1d. CHECK constraints — points, time_period, text lengths, whatsapp
ALTER TABLE public.contributions
  DROP CONSTRAINT IF EXISTS contributions_points_range;
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_points_range
  CHECK (points >= 1 AND points <= 1000);

ALTER TABLE public.contributions
  DROP CONSTRAINT IF EXISTS contributions_time_period_format;
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_time_period_format
  CHECK (time_period ~ '^\d{4}-(0[1-9]|1[0-2])$');

ALTER TABLE public.contributions
  DROP CONSTRAINT IF EXISTS contributions_project_name_length;
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_project_name_length
  CHECK (length(project_name) BETWEEN 1 AND 200);

ALTER TABLE public.contributions
  DROP CONSTRAINT IF EXISTS contributions_position_length;
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_position_length
  CHECK (length(position) BETWEEN 1 AND 100);

ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_full_name_length;
ALTER TABLE public.members
  ADD CONSTRAINT members_full_name_length
  CHECK (length(full_name) BETWEEN 1 AND 150);

ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_whatsapp_format;
ALTER TABLE public.members
  ADD CONSTRAINT members_whatsapp_format
  CHECK (whatsapp ~ '^\+?[1-9]\d{6,14}$');

ALTER TABLE public.app_users
  DROP CONSTRAINT IF EXISTS app_users_username_length;
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_username_length
  CHECK (length(username) BETWEEN 2 AND 50);

ALTER TABLE public.app_users
  DROP CONSTRAINT IF EXISTS app_users_designation_length;
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_designation_length
  CHECK (length(designation) BETWEEN 2 AND 100);

-- ============================================================
-- 2. HELPER SECURITY DEFINER FUNCTIONS
-- All functions: SECURITY DEFINER, SET search_path = '',
-- REVOKE from PUBLIC/anon, GRANT to authenticated.
-- ============================================================

-- 2a. get_my_role(): returns role only if app_users row exists
--     AND status = 'active'. Returns NULL otherwise.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role::text
  FROM public.app_users
  WHERE id = auth.uid()
    AND status = 'active';
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 2b. is_officer(): true for viewer, editor, super_admin
CREATE OR REPLACE FUNCTION public.is_officer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.get_my_role() IN ('viewer', 'editor', 'super_admin');
$$;

REVOKE EXECUTE ON FUNCTION public.is_officer() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_officer() TO authenticated;

-- 2c. is_editor_or_above()
CREATE OR REPLACE FUNCTION public.is_editor_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.get_my_role() IN ('editor', 'super_admin');
$$;

REVOKE EXECUTE ON FUNCTION public.is_editor_or_above() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_editor_or_above() TO authenticated;

-- 2d. is_super_admin()
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.get_my_role() = 'super_admin';
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- 2e. my_member_reg_no(): returns linked_member_reg_no for auth.uid()
CREATE OR REPLACE FUNCTION public.my_member_reg_no()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT linked_member_reg_no
  FROM public.app_users
  WHERE id = auth.uid()
    AND status = 'active';
$$;

REVOKE EXECUTE ON FUNCTION public.my_member_reg_no() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_member_reg_no() TO authenticated;

-- 2f. is_mfa_ok(): feature-flagged; defaults TRUE (off) so nobody is
--     locked out before MFA enrollment. When require_mfa_for_officers
--     setting is enabled, editors and super_admins must have aal = aal2.
CREATE OR REPLACE FUNCTION public.is_mfa_ok()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (
      -- Check if the require_mfa_for_officers setting is enabled
      EXISTS (
        SELECT 1 FROM public.app_settings
        WHERE key = 'require_mfa_for_officers'
          AND (value::text)::boolean = true
      )
      AND public.get_my_role() IN ('editor', 'super_admin')
      AND (auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2'
    ) THEN FALSE
    ELSE TRUE
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_mfa_ok() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_mfa_ok() TO authenticated;

-- Note: is_mfa_ok() references app_settings which is created in
-- migration 03_tiers_and_workflows. Until then it always returns TRUE
-- because the EXISTS() returns FALSE for a missing table. This is safe.

-- ============================================================
-- 3. FIX SECURITY DEFINER FUNCTIONS — add search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_member_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_reg_no TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_reg_no := OLD.member_reg_no;
  ELSE
    target_reg_no := NEW.member_reg_no;
  END IF;

  UPDATE public.members
  SET total_points = COALESCE((
        SELECT SUM(points)
        FROM public.contributions
        WHERE member_reg_no = target_reg_no
          -- Phase 3 will add: AND status = 'approved'
      ), 0),
      updated_at = NOW()
  WHERE reg_no = target_reg_no;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. REWRITE ALL RLS POLICIES — DEFAULT DENY
-- ============================================================

-- Drop every existing policy before recreating (idempotent).

-- --- members ---
DROP POLICY IF EXISTS "members_select"  ON public.members;
DROP POLICY IF EXISTS "members_insert"  ON public.members;
DROP POLICY IF EXISTS "members_update"  ON public.members;
DROP POLICY IF EXISTS "members_delete"  ON public.members;

-- Officers see all non-deleted rows; super_admin also sees deleted rows.
-- (member role — own row only — added in migration 02_member_accounts)
CREATE POLICY "members_select_officers"
  ON public.members FOR SELECT TO authenticated
  USING (
    public.get_my_role() IS NOT NULL AND (
      -- super_admin sees everything including soft-deleted
      public.get_my_role() = 'super_admin'
      OR (
        -- viewer/editor: non-deleted only
        public.get_my_role() IN ('viewer', 'editor')
        AND deleted_at IS NULL
      )
    )
  );

CREATE POLICY "members_insert_editor_plus"
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_editor_or_above()
  );

CREATE POLICY "members_update_editor_plus"
  ON public.members FOR UPDATE TO authenticated
  USING (public.is_editor_or_above() AND deleted_at IS NULL)
  WITH CHECK (public.is_editor_or_above());

-- Hard delete: super_admin only (soft-delete is the default path)
CREATE POLICY "members_delete_super_admin"
  ON public.members FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- --- contributions ---
DROP POLICY IF EXISTS "contributions_select"  ON public.contributions;
DROP POLICY IF EXISTS "contributions_insert"  ON public.contributions;
DROP POLICY IF EXISTS "contributions_update"  ON public.contributions;
DROP POLICY IF EXISTS "contributions_delete"  ON public.contributions;

-- Officers see all; member sees own (added in 02_member_accounts)
CREATE POLICY "contributions_select_officers"
  ON public.contributions FOR SELECT TO authenticated
  USING (public.is_officer());

CREATE POLICY "contributions_insert_editor_plus"
  ON public.contributions FOR INSERT TO authenticated
  WITH CHECK (public.is_editor_or_above());

-- editor: only their own pending entries; super_admin: always
CREATE POLICY "contributions_update_restricted"
  ON public.contributions FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (
    public.get_my_role() = 'editor' AND added_by = auth.uid()
  ))
  WITH CHECK (public.is_super_admin() OR (
    public.get_my_role() = 'editor' AND added_by = auth.uid()
  ));

CREATE POLICY "contributions_delete_super_admin"
  ON public.contributions FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- --- app_users ---
DROP POLICY IF EXISTS "app_users_select"  ON public.app_users;
DROP POLICY IF EXISTS "app_users_insert"  ON public.app_users;
DROP POLICY IF EXISTS "app_users_update"  ON public.app_users;
DROP POLICY IF EXISTS "app_users_delete"  ON public.app_users;

-- Self-row select; super_admin sees all; officers see username+designation only
-- (enforced by column-level privileges is not possible in PostgREST; we return all
--  columns but the controller logic must not expose sensitive fields to non-admins)
CREATE POLICY "app_users_select_self_or_admin"
  ON public.app_users FOR SELECT TO authenticated
  USING (
    public.get_my_role() IS NOT NULL AND (
      id = auth.uid()
      OR public.is_super_admin()
      OR public.is_officer()   -- officers can read for linking purposes
    )
  );

-- INSERT: only via Edge Function (service role context bypasses RLS)
-- We still need a policy to block direct PostgREST inserts from the client.
CREATE POLICY "app_users_insert_super_admin_only"
  ON public.app_users FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- UPDATE: super_admin only. No self-update of role/status/linked_member_reg_no.
-- The trigger below enforces column-level restrictions.
CREATE POLICY "app_users_update_super_admin_only"
  ON public.app_users FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- DELETE: super_admin only (also handled by Edge Function)
CREATE POLICY "app_users_delete_super_admin_only"
  ON public.app_users FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- --- faculties, batches, avenues ---
DROP POLICY IF EXISTS "faculties_select" ON public.faculties;
DROP POLICY IF EXISTS "faculties_all"    ON public.faculties;
DROP POLICY IF EXISTS "batches_select"   ON public.batches;
DROP POLICY IF EXISTS "batches_all"      ON public.batches;
DROP POLICY IF EXISTS "avenues_select"   ON public.avenues;
DROP POLICY IF EXISTS "avenues_all"      ON public.avenues;

CREATE POLICY "faculties_select_active_roles"
  ON public.faculties FOR SELECT TO authenticated
  USING (public.get_my_role() IS NOT NULL);

CREATE POLICY "faculties_insert_editor_plus"
  ON public.faculties FOR INSERT TO authenticated
  WITH CHECK (public.is_editor_or_above());

CREATE POLICY "faculties_update_editor_plus"
  ON public.faculties FOR UPDATE TO authenticated
  USING (public.is_editor_or_above())
  WITH CHECK (public.is_editor_or_above());

CREATE POLICY "faculties_delete_super_admin"
  ON public.faculties FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "batches_select_active_roles"
  ON public.batches FOR SELECT TO authenticated
  USING (public.get_my_role() IS NOT NULL);

CREATE POLICY "batches_insert_editor_plus"
  ON public.batches FOR INSERT TO authenticated
  WITH CHECK (public.is_editor_or_above());

CREATE POLICY "batches_update_editor_plus"
  ON public.batches FOR UPDATE TO authenticated
  USING (public.is_editor_or_above())
  WITH CHECK (public.is_editor_or_above());

CREATE POLICY "batches_delete_super_admin"
  ON public.batches FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "avenues_select_active_roles"
  ON public.avenues FOR SELECT TO authenticated
  USING (public.get_my_role() IS NOT NULL);

CREATE POLICY "avenues_insert_editor_plus"
  ON public.avenues FOR INSERT TO authenticated
  WITH CHECK (public.is_editor_or_above());

CREATE POLICY "avenues_update_editor_plus"
  ON public.avenues FOR UPDATE TO authenticated
  USING (public.is_editor_or_above())
  WITH CHECK (public.is_editor_or_above());

CREATE POLICY "avenues_delete_super_admin"
  ON public.avenues FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- --- system_logs ---
DROP POLICY IF EXISTS "system_logs_select" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_insert" ON public.system_logs;

CREATE POLICY "system_logs_select_super_admin"
  ON public.system_logs FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- INSERT deliberately has NO policy here — only SECURITY DEFINER
-- functions and DB triggers (running as role = postgres) can write.
-- We explicitly deny INSERT from the client by not granting a policy.

-- Revoke INSERT on system_logs from authenticated (belt-and-suspenders)
REVOKE INSERT ON public.system_logs FROM authenticated;

-- --- storage.objects (members bucket) ---
DROP POLICY IF EXISTS "storage_members_public_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_members_insert"        ON storage.objects;
DROP POLICY IF EXISTS "storage_members_update"        ON storage.objects;
DROP POLICY IF EXISTS "storage_members_delete"        ON storage.objects;

-- Private bucket: only active roles can read (requires bucket to be set private)
CREATE POLICY "storage_members_select_active_roles"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'members'
    AND public.get_my_role() IS NOT NULL
  );

-- editor+ can upload; member can upload only their own photo path
-- (member-specific policy added in 02_member_accounts)
CREATE POLICY "storage_members_insert_editor_plus"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'members'
    AND public.is_editor_or_above()
  );

CREATE POLICY "storage_members_update_editor_plus"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'members'
    AND public.is_editor_or_above()
  );

CREATE POLICY "storage_members_delete_super_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'members'
    AND public.is_super_admin()
  );

-- ============================================================
-- 5. TRIGGERS FOR SECURITY ENFORCEMENT
-- ============================================================

-- 5a. BEFORE UPDATE on app_users: block changes to protected columns
--     unless the caller is super_admin or auth.uid() IS NULL (service role).
CREATE OR REPLACE FUNCTION public.guard_app_users_protected_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Service-role / SQL editor context: auth.uid() is NULL → allow all
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block changes to role, status, linked_member_reg_no by non-super-admins
  IF (NEW.role              IS DISTINCT FROM OLD.role OR
      NEW.status            IS DISTINCT FROM OLD.status OR
      NEW.linked_member_reg_no IS DISTINCT FROM OLD.linked_member_reg_no)
  AND public.get_my_role() IS DISTINCT FROM 'super_admin'
  THEN
    RAISE EXCEPTION 'Permission denied: only super_admin may change role, status, or linked_member_reg_no'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_app_users_cols ON public.app_users;
CREATE TRIGGER trg_guard_app_users_cols
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.guard_app_users_protected_columns();

-- 5b. Guard: cannot remove or demote the last super_admin
CREATE OR REPLACE FUNCTION public.guard_last_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- On DELETE: was this the last super_admin?
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'super_admin' THEN
      IF (SELECT COUNT(*) FROM public.app_users WHERE role = 'super_admin' AND id <> OLD.id) = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last super_admin account'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- On UPDATE: role is being changed away from super_admin
  IF TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
    IF (SELECT COUNT(*) FROM public.app_users WHERE role = 'super_admin' AND id <> OLD.id) = 0 THEN
      RAISE EXCEPTION 'Cannot demote the last super_admin account'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_last_super_admin ON public.app_users;
CREATE TRIGGER trg_guard_last_super_admin
  BEFORE DELETE OR UPDATE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_super_admin();

-- 5c. Block self-award: editors cannot create contributions for themselves
CREATE OR REPLACE FUNCTION public.guard_contribution_self_award()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only check editor role (super_admin is exempt; members cannot insert)
  IF public.get_my_role() = 'editor'
     AND NEW.member_reg_no = public.my_member_reg_no()
     AND NEW.member_reg_no IS NOT NULL
  THEN
    RAISE EXCEPTION 'Editors cannot award points to themselves'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_self_award ON public.contributions;
CREATE TRIGGER trg_guard_self_award
  BEFORE INSERT ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.guard_contribution_self_award();

-- ============================================================
-- 6. SERVER-SIDE AUDIT LOG RPCs
-- Clients can only call log_login() and log_export(); they cannot
-- INSERT directly into system_logs anymore.
-- ============================================================

-- Grant INSERT back to the postgres role (used by SECURITY DEFINER functions)
-- The REVOKE above blocked authenticated; postgres still has it by default.

CREATE OR REPLACE FUNCTION public.log_login()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_username TEXT;
  v_user_id  UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Only log officer logins (not member logins)
  IF public.get_my_role() NOT IN ('viewer', 'editor', 'super_admin') THEN
    RETURN;
  END IF;

  SELECT username INTO v_username
  FROM public.app_users
  WHERE id = v_user_id;

  INSERT INTO public.system_logs (user_id, user_name, action, details, entity_type, entity_id)
  VALUES (v_user_id, v_username, 'LOGIN', '{"method":"password"}'::jsonb, 'session', v_user_id::text);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_login() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_login() TO authenticated;

CREATE OR REPLACE FUNCTION public.log_export(p_details JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_username TEXT;
  v_user_id  UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Only officers can export
  IF NOT public.is_officer() THEN
    RAISE EXCEPTION 'Unauthorized: only officers may log exports'
      USING ERRCODE = '42501';
  END IF;

  SELECT username INTO v_username
  FROM public.app_users
  WHERE id = v_user_id;

  INSERT INTO public.system_logs (user_id, user_name, action, details, entity_type)
  VALUES (v_user_id, v_username, 'EXPORT', p_details, 'export');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_export(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_export(JSONB) TO authenticated;

-- ============================================================
-- 7. AUDIT LOG TRIGGER — server-side for members & app_users
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_username  TEXT;
  v_user_id   UUID;
  v_action    TEXT;
  v_entity_id TEXT;
  v_details   JSONB;
BEGIN
  v_user_id := auth.uid();

  SELECT username INTO v_username
  FROM public.app_users
  WHERE id = v_user_id;

  CASE TG_OP
    WHEN 'INSERT' THEN
      v_action  := 'CREATE_' || upper(TG_TABLE_NAME);
      v_entity_id := CASE TG_TABLE_NAME
                       WHEN 'members'  THEN (row_to_json(NEW)->>'reg_no')
                       WHEN 'contributions' THEN (row_to_json(NEW)->>'id')
                       ELSE (row_to_json(NEW)->>'id')
                     END;
      v_details := to_jsonb(NEW);
    WHEN 'UPDATE' THEN
      v_action  := 'UPDATE_' || upper(TG_TABLE_NAME);
      v_entity_id := CASE TG_TABLE_NAME
                       WHEN 'members'  THEN (row_to_json(NEW)->>'reg_no')
                       WHEN 'contributions' THEN (row_to_json(NEW)->>'id')
                       ELSE (row_to_json(NEW)->>'id')
                     END;
      v_details := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
    WHEN 'DELETE' THEN
      v_action  := 'DELETE_' || upper(TG_TABLE_NAME);
      v_entity_id := CASE TG_TABLE_NAME
                       WHEN 'members'  THEN (row_to_json(OLD)->>'reg_no')
                       WHEN 'contributions' THEN (row_to_json(OLD)->>'id')
                       ELSE (row_to_json(OLD)->>'id')
                     END;
      v_details := to_jsonb(OLD);
  END CASE;

  -- Strip sensitive fields from details before logging
  v_details := v_details
    - 'whatsapp'
    - 'email'
    - 'my_lci_num';

  INSERT INTO public.system_logs
    (user_id, user_name, action, details, entity_type, entity_id)
  VALUES
    (v_user_id, COALESCE(v_username, 'system'), v_action, v_details, TG_TABLE_NAME, v_entity_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit triggers to key tables
DROP TRIGGER IF EXISTS trg_audit_members ON public.members;
CREATE TRIGGER trg_audit_members
  AFTER INSERT OR UPDATE OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS trg_audit_contributions ON public.contributions;
CREATE TRIGGER trg_audit_contributions
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS trg_audit_app_users ON public.app_users;
CREATE TRIGGER trg_audit_app_users
  AFTER INSERT OR UPDATE OR DELETE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- ============================================================
-- 8. SMOKE TESTS (run after migration to validate)
-- ============================================================
-- Expected results:
--
-- SELECT public.get_my_role();
--   → NULL (no active session in SQL editor)
--
-- SELECT COUNT(*) FROM pg_policies WHERE tablename = 'members';
--   → 4 (select_officers, insert_editor_plus, update_editor_plus, delete_super_admin)
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'app_users' AND column_name = 'status';
--   → 'status'
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'members' AND column_name = 'deleted_at';
--   → 'deleted_at'
--
-- SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.contributions'::regclass
--     AND conname = 'contributions_points_range';
--   → 'contributions_points_range'

COMMIT;

-- ============================================================
-- ROLLBACK PLAN (apply in reverse order if needed):
-- ============================================================
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_audit_app_users    ON public.app_users;
-- DROP TRIGGER IF EXISTS trg_audit_contributions ON public.contributions;
-- DROP TRIGGER IF EXISTS trg_audit_members       ON public.members;
-- DROP TRIGGER IF EXISTS trg_guard_self_award    ON public.contributions;
-- DROP TRIGGER IF EXISTS trg_guard_last_super_admin ON public.app_users;
-- DROP TRIGGER IF EXISTS trg_guard_app_users_cols ON public.app_users;
-- DROP FUNCTION IF EXISTS public.audit_log_trigger();
-- DROP FUNCTION IF EXISTS public.guard_contribution_self_award();
-- DROP FUNCTION IF EXISTS public.guard_last_super_admin();
-- DROP FUNCTION IF EXISTS public.guard_app_users_protected_columns();
-- DROP FUNCTION IF EXISTS public.log_export(JSONB);
-- DROP FUNCTION IF EXISTS public.log_login();
-- DROP FUNCTION IF EXISTS public.is_mfa_ok();
-- DROP FUNCTION IF EXISTS public.my_member_reg_no();
-- DROP FUNCTION IF EXISTS public.is_super_admin();
-- DROP FUNCTION IF EXISTS public.is_editor_or_above();
-- DROP FUNCTION IF EXISTS public.is_officer();
-- -- Restore original get_my_role() (no search_path):
-- CREATE OR REPLACE FUNCTION public.get_my_role()
--   RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
--   SELECT role::text FROM public.app_users WHERE id = auth.uid();
-- $$;
-- -- Restore original policies (see supabase_schema.sql):
-- --   [paste original policy SQL from supabase_schema.sql here]
-- ALTER TABLE public.app_users   DROP COLUMN IF EXISTS status;
-- ALTER TABLE public.members     DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE public.members     DROP COLUMN IF EXISTS email;
-- ALTER TABLE public.members     DROP COLUMN IF EXISTS leaderboard_opt_out;
-- ALTER TABLE public.members     DROP COLUMN IF EXISTS display_alias;
-- ALTER TABLE public.members     DROP COLUMN IF EXISTS member_status;
-- DROP INDEX IF EXISTS idx_members_email_unique;
-- COMMIT;
-- ============================================================
