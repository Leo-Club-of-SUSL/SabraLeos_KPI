-- ============================================================
-- Migration: 20261007000003_perf_indexes_and_rls_subqueries.sql
-- Description:
--   1. Add missing foreign key supporting indexes & query filter/sort indexes
--   2. Optimize RLS policy execution by wrapping helper function calls in subqueries
--      (converts per-row re-evaluation to per-query InitPlan caching)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. FOREIGN KEY SUPPORTING & QUERY PERFORMANCE INDEXES
-- ============================================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_contributions_member_reg_no
    ON public.contributions (member_reg_no);

CREATE INDEX IF NOT EXISTS idx_contributions_added_by
    ON public.contributions (added_by);

CREATE INDEX IF NOT EXISTS idx_app_users_linked_member_reg_no
    ON public.app_users (linked_member_reg_no);

CREATE INDEX IF NOT EXISTS idx_system_logs_user_id
    ON public.system_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id
    ON public.security_events (user_id);

CREATE INDEX IF NOT EXISTS idx_security_events_actor_id
    ON public.security_events (actor_id);

CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved_by
    ON public.security_alerts (resolved_by);

-- Query filtering, sorting & partial indexes
CREATE INDEX IF NOT EXISTS idx_contributions_time_period
    ON public.contributions (time_period);

CREATE INDEX IF NOT EXISTS idx_contributions_date_added_desc
    ON public.contributions (date_added DESC);

CREATE INDEX IF NOT EXISTS idx_members_total_points_active
    ON public.members (total_points DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_members_faculty_active
    ON public.members (faculty)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_members_batch_active
    ON public.members (batch)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_members_deleted_at
    ON public.members (deleted_at);

-- ============================================================
-- 2. CONFIRM HELPER FUNCTIONS ARE STABLE & SECURITY DEFINER
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.is_officer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT public.get_my_role()) IN ('viewer', 'editor', 'super_admin');
$$;

REVOKE EXECUTE ON FUNCTION public.is_officer() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_officer() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_editor_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT public.get_my_role()) IN ('editor', 'super_admin');
$$;

REVOKE EXECUTE ON FUNCTION public.is_editor_or_above() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_editor_or_above() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT public.get_my_role()) = 'super_admin';
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

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

-- ============================================================
-- 3. OPTIMIZE RLS POLICIES (SUBQUERY WRAPPING)
-- ============================================================

-- A. public.members
DROP POLICY IF EXISTS "members_select_officers" ON public.members;
CREATE POLICY "members_select_officers"
    ON public.members FOR SELECT TO authenticated
    USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "members_insert_editor_plus" ON public.members;
CREATE POLICY "members_insert_editor_plus"
    ON public.members FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.is_editor_or_above()));

DROP POLICY IF EXISTS "members_update_editor_plus" ON public.members;
CREATE POLICY "members_update_editor_plus"
    ON public.members FOR UPDATE TO authenticated
    USING ((SELECT public.is_editor_or_above()))
    WITH CHECK ((SELECT public.is_editor_or_above()));

DROP POLICY IF EXISTS "members_delete_super_admin" ON public.members;
CREATE POLICY "members_delete_super_admin"
    ON public.members FOR DELETE TO authenticated
    USING ((SELECT public.is_super_admin()));

-- B. public.contributions
DROP POLICY IF EXISTS "contributions_select_officers" ON public.contributions;
CREATE POLICY "contributions_select_officers"
    ON public.contributions FOR SELECT TO authenticated
    USING (
        (SELECT public.is_officer())
        OR ((SELECT public.get_my_role()) = 'member' AND member_reg_no = (SELECT public.my_member_reg_no()))
    );

DROP POLICY IF EXISTS "contributions_insert_editor_plus" ON public.contributions;
CREATE POLICY "contributions_insert_editor_plus"
    ON public.contributions FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.is_editor_or_above()));

DROP POLICY IF EXISTS "contributions_update_restricted" ON public.contributions;
CREATE POLICY "contributions_update_restricted"
    ON public.contributions FOR UPDATE TO authenticated
    USING (
        ((SELECT public.is_super_admin()))
        OR ((SELECT public.is_editor_or_above()) AND added_by = auth.uid())
    )
    WITH CHECK (
        ((SELECT public.is_super_admin()))
        OR ((SELECT public.is_editor_or_above()) AND added_by = auth.uid())
    );

DROP POLICY IF EXISTS "contributions_delete_super_admin" ON public.contributions;
CREATE POLICY "contributions_delete_super_admin"
    ON public.contributions FOR DELETE TO authenticated
    USING ((SELECT public.is_super_admin()));

-- C. public.app_users
DROP POLICY IF EXISTS "app_users_select_self_or_admin" ON public.app_users;
CREATE POLICY "app_users_select_self_or_admin"
    ON public.app_users FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR (SELECT public.is_super_admin())
    );

DROP POLICY IF EXISTS "app_users_insert_super_admin_only" ON public.app_users;
CREATE POLICY "app_users_insert_super_admin_only"
    ON public.app_users FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "app_users_update_super_admin_only" ON public.app_users;
CREATE POLICY "app_users_update_super_admin_only"
    ON public.app_users FOR UPDATE TO authenticated
    USING (
        id = auth.uid()
        OR (SELECT public.is_super_admin())
    )
    WITH CHECK (
        ((SELECT public.is_super_admin()))
        OR (id = auth.uid() AND role = (SELECT public.get_my_role()))
    );

DROP POLICY IF EXISTS "app_users_delete_super_admin_only" ON public.app_users;
CREATE POLICY "app_users_delete_super_admin_only"
    ON public.app_users FOR DELETE TO authenticated
    USING ((SELECT public.is_super_admin()));

-- D. public.faculties
DROP POLICY IF EXISTS "faculties_select_active_roles" ON public.faculties;
CREATE POLICY "faculties_select_active_roles"
    ON public.faculties FOR SELECT TO authenticated
    USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "faculties_insert_editor_plus" ON public.faculties;
CREATE POLICY "faculties_insert_editor_plus"
    ON public.faculties FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.is_editor_or_above()));

DROP POLICY IF EXISTS "faculties_update_editor_plus" ON public.faculties;
CREATE POLICY "faculties_update_editor_plus"
    ON public.faculties FOR UPDATE TO authenticated
    USING ((SELECT public.is_editor_or_above()))
    WITH CHECK ((SELECT public.is_editor_or_above()));

DROP POLICY IF EXISTS "faculties_delete_super_admin" ON public.faculties;
CREATE POLICY "faculties_delete_super_admin"
    ON public.faculties FOR DELETE TO authenticated
    USING ((SELECT public.is_super_admin()));

-- E. public.batches
DROP POLICY IF EXISTS "batches_select_active_roles" ON public.batches;
CREATE POLICY "batches_select_active_roles"
    ON public.batches FOR SELECT TO authenticated
    USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "batches_insert_editor_plus" ON public.batches;
CREATE POLICY "batches_insert_editor_plus"
    ON public.batches FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.is_editor_or_above()));

DROP POLICY IF EXISTS "batches_update_editor_plus" ON public.batches;
CREATE POLICY "batches_update_editor_plus"
    ON public.batches FOR UPDATE TO authenticated
    USING ((SELECT public.is_editor_or_above()))
    WITH CHECK ((SELECT public.is_editor_or_above()));

DROP POLICY IF EXISTS "batches_delete_super_admin" ON public.batches;
CREATE POLICY "batches_delete_super_admin"
    ON public.batches FOR DELETE TO authenticated
    USING ((SELECT public.is_super_admin()));

-- F. public.avenues
DROP POLICY IF EXISTS "avenues_select_active_roles" ON public.avenues;
CREATE POLICY "avenues_select_active_roles"
    ON public.avenues FOR SELECT TO authenticated
    USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "avenues_insert_editor_plus" ON public.avenues;
CREATE POLICY "avenues_insert_editor_plus"
    ON public.avenues FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.is_editor_or_above()));

DROP POLICY IF EXISTS "avenues_update_editor_plus" ON public.avenues;
CREATE POLICY "avenues_update_editor_plus"
    ON public.avenues FOR UPDATE TO authenticated
    USING ((SELECT public.is_editor_or_above()))
    WITH CHECK ((SELECT public.is_editor_or_above()));

DROP POLICY IF EXISTS "avenues_delete_super_admin" ON public.avenues;
CREATE POLICY "avenues_delete_super_admin"
    ON public.avenues FOR DELETE TO authenticated
    USING ((SELECT public.is_super_admin()));

-- G. public.system_logs
DROP POLICY IF EXISTS "system_logs_select_super_admin" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_select_officer" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_select" ON public.system_logs;
CREATE POLICY "system_logs_select_officer"
    ON public.system_logs FOR SELECT TO authenticated
    USING ((SELECT public.is_officer()));

-- H. public.security_events
DROP POLICY IF EXISTS "security_events_select_super_admin" ON public.security_events;
DROP POLICY IF EXISTS "security_events_select_officer" ON public.security_events;
DROP POLICY IF EXISTS "security_events_select" ON public.security_events;
CREATE POLICY "security_events_select_officer"
    ON public.security_events FOR SELECT TO authenticated
    USING ((SELECT public.is_officer()));

-- I. public.security_alerts
DROP POLICY IF EXISTS "security_alerts_super_admin" ON public.security_alerts;
CREATE POLICY "security_alerts_super_admin"
    ON public.security_alerts FOR ALL TO authenticated
    USING ((SELECT public.is_super_admin()))
    WITH CHECK ((SELECT public.is_super_admin()));

-- J. public.system_settings
DROP POLICY IF EXISTS "system_settings_select_active_users" ON public.system_settings;
CREATE POLICY "system_settings_select_active_users"
    ON public.system_settings FOR SELECT TO authenticated
    USING ((SELECT public.get_my_role()) IS NOT NULL);

-- K. storage.objects (members bucket)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    DROP POLICY IF EXISTS "storage_members_select_active_roles" ON storage.objects;
    CREATE POLICY "storage_members_select_active_roles"
        ON storage.objects FOR SELECT TO authenticated
        USING (bucket_id = 'members' AND (SELECT public.get_my_role()) IS NOT NULL);

    DROP POLICY IF EXISTS "storage_members_insert_editor_plus" ON storage.objects;
    CREATE POLICY "storage_members_insert_editor_plus"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'members' AND (SELECT public.is_editor_or_above()));

    DROP POLICY IF EXISTS "storage_members_update_editor_plus" ON storage.objects;
    CREATE POLICY "storage_members_update_editor_plus"
        ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id = 'members' AND (SELECT public.is_editor_or_above()));

    DROP POLICY IF EXISTS "storage_members_delete_super_admin" ON storage.objects;
    CREATE POLICY "storage_members_delete_super_admin"
        ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'members' AND (SELECT public.is_super_admin()));
  END IF;
END $$;

COMMIT;
