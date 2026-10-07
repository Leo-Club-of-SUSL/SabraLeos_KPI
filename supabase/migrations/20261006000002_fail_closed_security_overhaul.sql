-- ============================================================
-- Migration: 20261006000002_fail_closed_security_overhaul.sql
-- Description: Fail-closed security overhaul:
--   1. schema_meta & get_schema_version()
--   2. Hardened system_settings with update_tier_thresholds & preview_tier_changes RPCs
--   3. security_events & security_alerts tables and triggers
--   4. get_my_session_context() RPC
--   5. Strict RLS and anon role lock-down
-- ============================================================
-- ROLLBACK NOTE:
-- DROP FUNCTION IF EXISTS public.get_schema_version();
-- DROP TABLE IF EXISTS public.schema_meta;
-- DROP FUNCTION IF EXISTS public.preview_tier_changes(jsonb);
-- DROP FUNCTION IF EXISTS public.update_tier_thresholds(jsonb);
-- DROP TABLE IF EXISTS public.security_alerts;
-- DROP TABLE IF EXISTS public.security_events;
-- ============================================================

BEGIN;

-- ============================================================
-- 0. BASE SCHEMA PREREQUISITES (IDEMPOTENT)
-- ============================================================

-- Ensure app_users table and status column exist
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    designation TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'super_admin', 'member')),
    linked_member_reg_no TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended'));

-- Ensure members table and columns exist
CREATE TABLE IF NOT EXISTS public.members (
    reg_no TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    name_with_initials TEXT NOT NULL,
    faculty TEXT NOT NULL,
    batch TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    photo_url TEXT,
    total_points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS member_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS leaderboard_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_alias TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- 0B. CORE ROLE & SECURITY HELPER FUNCTIONS (IDEMPOTENT)
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
  SELECT public.get_my_role() IN ('viewer', 'editor', 'super_admin');
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
  SELECT public.get_my_role() IN ('editor', 'super_admin');
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
  SELECT public.get_my_role() = 'super_admin';
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
-- 1. SCHEMA VERSION TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS public.schema_meta (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    description TEXT
);

ALTER TABLE public.schema_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schema_meta_select_authenticated" ON public.schema_meta;
CREATE POLICY "schema_meta_select_authenticated"
    ON public.schema_meta FOR SELECT TO authenticated
    USING (true);

-- Current schema version
INSERT INTO public.schema_meta (version, description)
VALUES ('2026.10.06.1', 'Fail-closed invite-only security overhaul and tiered thresholds')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

CREATE OR REPLACE FUNCTION public.get_schema_version()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT version FROM public.schema_meta ORDER BY applied_at DESC LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_schema_version() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_schema_version() TO authenticated;

-- ============================================================
-- 2. ENSURE ALL PHASE 2 COLUMNS EXIST ON MEMBERS & APP_USERS
-- ============================================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS leaderboard_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_alias TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS member_status TEXT NOT NULL DEFAULT 'active' CHECK (member_status IN ('active', 'alumni')),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_unique
  ON public.members (lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));

-- ============================================================
-- 3. HARDENED SYSTEM SETTINGS & TIER MANAGEMENT RPCS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- SELECT requires an active officer/member role (get_my_role() IS NOT NULL)
DROP POLICY IF EXISTS "system_settings_select" ON public.system_settings;
DROP POLICY IF EXISTS "Allow authenticated users to read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow super_admin to manage system settings" ON public.system_settings;

CREATE POLICY "system_settings_select_active_users"
    ON public.system_settings FOR SELECT TO authenticated
    USING (public.get_my_role() IS NOT NULL);

-- Revoke direct table writes from authenticated (writes ONLY allowed via RPC)
REVOKE INSERT, UPDATE, DELETE ON public.system_settings FROM authenticated, anon, PUBLIC;

-- Seed default tier thresholds
INSERT INTO public.system_settings (key, value)
VALUES (
    'tier_thresholds',
    '{"prospect": 0, "official": 50, "bronze": 150, "silver": 300, "gold": 500, "platinum": 800}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Function: preview_tier_changes(p_thresholds jsonb)
-- Simulates new thresholds against current active member points without modifying DB.
CREATE OR REPLACE FUNCTION public.preview_tier_changes(p_thresholds jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_prospect INT;
  v_official INT;
  v_bronze INT;
  v_silver INT;
  v_gold INT;
  v_platinum INT;
  v_curr_thresholds jsonb;
  v_c_prospect INT;
  v_c_official INT;
  v_c_bronze INT;
  v_c_silver INT;
  v_c_gold INT;
  v_c_platinum INT;
  v_promotions INT := 0;
  v_demotions INT := 0;
  v_unchanged INT := 0;
  v_before_counts jsonb;
  v_after_counts jsonb;
  r RECORD;
  v_old_tier INT;
  v_new_tier INT;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: super_admin role required to preview tier changes';
  END IF;

  -- Validate keys
  IF NOT (
    p_thresholds ? 'prospect' AND
    p_thresholds ? 'official' AND
    p_thresholds ? 'bronze' AND
    p_thresholds ? 'silver' AND
    p_thresholds ? 'gold' AND
    p_thresholds ? 'platinum'
  ) THEN
    RAISE EXCEPTION 'Invalid thresholds: must contain prospect, official, bronze, silver, gold, platinum';
  END IF;

  v_prospect := (p_thresholds->>'prospect')::INT;
  v_official := (p_thresholds->>'official')::INT;
  v_bronze := (p_thresholds->>'bronze')::INT;
  v_silver := (p_thresholds->>'silver')::INT;
  v_gold := (p_thresholds->>'gold')::INT;
  v_platinum := (p_thresholds->>'platinum')::INT;

  IF v_prospect != 0 OR v_official <= v_prospect OR v_bronze <= v_official OR v_silver <= v_bronze OR v_gold <= v_silver OR v_platinum <= v_gold THEN
    RAISE EXCEPTION 'Thresholds must be strictly ascending integers starting with prospect=0';
  END IF;

  -- Get current thresholds
  SELECT value INTO v_curr_thresholds FROM public.system_settings WHERE key = 'tier_thresholds';
  IF v_curr_thresholds IS NULL THEN
    v_curr_thresholds := '{"prospect": 0, "official": 50, "bronze": 150, "silver": 300, "gold": 500, "platinum": 800}'::jsonb;
  END IF;

  v_c_prospect := (v_curr_thresholds->>'prospect')::INT;
  v_c_official := (v_curr_thresholds->>'official')::INT;
  v_c_bronze := (v_curr_thresholds->>'bronze')::INT;
  v_c_silver := (v_curr_thresholds->>'silver')::INT;
  v_c_gold := (v_curr_thresholds->>'gold')::INT;
  v_c_platinum := (v_curr_thresholds->>'platinum')::INT;

  FOR r IN (SELECT total_points FROM public.members WHERE deleted_at IS NULL) LOOP
    -- Old tier rank 0..5
    IF r.total_points >= v_c_platinum THEN v_old_tier := 5;
    ELSIF r.total_points >= v_c_gold THEN v_old_tier := 4;
    ELSIF r.total_points >= v_c_silver THEN v_old_tier := 3;
    ELSIF r.total_points >= v_c_bronze THEN v_old_tier := 2;
    ELSIF r.total_points >= v_c_official THEN v_old_tier := 1;
    ELSE v_old_tier := 0;
    END IF;

    -- New tier rank 0..5
    IF r.total_points >= v_platinum THEN v_new_tier := 5;
    ELSIF r.total_points >= v_gold THEN v_new_tier := 4;
    ELSIF r.total_points >= v_silver THEN v_new_tier := 3;
    ELSIF r.total_points >= v_bronze THEN v_new_tier := 2;
    ELSIF r.total_points >= v_official THEN v_new_tier := 1;
    ELSE v_new_tier := 0;
    END IF;

    IF v_new_tier > v_old_tier THEN
      v_promotions := v_promotions + 1;
    ELSIF v_new_tier < v_old_tier THEN
      v_demotions := v_demotions + 1;
    ELSE
      v_unchanged := v_unchanged + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'promotions', v_promotions,
    'demotions', v_demotions,
    'unchanged', v_unchanged,
    'total_members', v_promotions + v_demotions + v_unchanged
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_tier_changes(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_tier_changes(jsonb) TO authenticated;

-- Function: update_tier_thresholds(p_thresholds jsonb)
-- Securely updates thresholds with validation, auditing, and alert triggering.
CREATE OR REPLACE FUNCTION public.update_tier_thresholds(p_thresholds jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_caller_id UUID;
  v_prospect INT;
  v_official INT;
  v_bronze INT;
  v_silver INT;
  v_gold INT;
  v_platinum INT;
  v_old_val JSONB;
BEGIN
  v_caller_id := auth.uid();
  v_role := public.get_my_role();

  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: Only active super_admin can update tier thresholds';
  END IF;

  -- Validate keys
  IF NOT (
    p_thresholds ? 'prospect' AND
    p_thresholds ? 'official' AND
    p_thresholds ? 'bronze' AND
    p_thresholds ? 'silver' AND
    p_thresholds ? 'gold' AND
    p_thresholds ? 'platinum'
  ) THEN
    RAISE EXCEPTION 'Invalid thresholds payload: must contain prospect, official, bronze, silver, gold, platinum';
  END IF;

  v_prospect := (p_thresholds->>'prospect')::INT;
  v_official := (p_thresholds->>'official')::INT;
  v_bronze := (p_thresholds->>'bronze')::INT;
  v_silver := (p_thresholds->>'silver')::INT;
  v_gold := (p_thresholds->>'gold')::INT;
  v_platinum := (p_thresholds->>'platinum')::INT;

  IF v_prospect != 0 OR v_official <= v_prospect OR v_bronze <= v_official OR v_silver <= v_bronze OR v_gold <= v_silver OR v_platinum <= v_gold THEN
    RAISE EXCEPTION 'Thresholds must be strictly ascending integers starting with prospect=0';
  END IF;

  SELECT value INTO v_old_val FROM public.system_settings WHERE key = 'tier_thresholds';

  INSERT INTO public.system_settings (key, value, updated_at, updated_by)
  VALUES ('tier_thresholds', p_thresholds, NOW(), v_caller_id)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by;

  -- Audit log entry
  INSERT INTO public.system_logs (user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    v_caller_id,
    'UPDATE_TIER_THRESHOLDS',
    'system_settings',
    'tier_thresholds',
    v_old_val::text,
    p_thresholds::text
  );

  RETURN p_thresholds;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_tier_thresholds(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_tier_thresholds(jsonb) TO authenticated;

-- ============================================================
-- 4. SECURITY EVENTS & AUDIT LOGGING
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS new_value TEXT;

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_logs_select_super_admin" ON public.system_logs;
CREATE POLICY "system_logs_select_super_admin"
    ON public.system_logs FOR SELECT TO authenticated
    USING (public.is_super_admin());

REVOKE INSERT, UPDATE, DELETE ON public.system_logs FROM authenticated, anon, PUBLIC;

CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_events_select_super_admin"
    ON public.security_events FOR SELECT TO authenticated
    USING (public.is_super_admin());

REVOKE INSERT, UPDATE, DELETE ON public.security_events FROM authenticated, anon, PUBLIC;

-- RPC: log_security_event
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_event_type TEXT,
    p_target_user_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.security_events (event_type, user_id, actor_id, details)
  VALUES (p_event_type, COALESCE(p_target_user_id, auth.uid()), auth.uid(), p_details);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_security_event(TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(TEXT, UUID, JSONB) TO authenticated;

-- ============================================================
-- 5. SECURITY ALERTS TABLE & AUTOMATED TRIGGERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_alerts_super_admin"
    ON public.security_alerts FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Trigger on app_users: Alert on privileged account creation, role changes, suspensions
CREATE OR REPLACE FUNCTION public.trg_app_users_security_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IN ('editor', 'super_admin') THEN
      INSERT INTO public.security_alerts (alert_type, severity, title, description, metadata)
      VALUES (
        'PRIVILEGED_ACCOUNT_CREATED',
        'high',
        'Privileged Account Created: ' || NEW.username,
        'A new ' || NEW.role || ' account was created for ' || NEW.username || ' (Designation: ' || NEW.designation || ')',
        jsonb_build_object('user_id', NEW.id, 'role', NEW.role, 'username', NEW.username)
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      INSERT INTO public.security_alerts (alert_type, severity, title, description, metadata)
      VALUES (
        'ROLE_CHANGED',
        'critical',
        'User Role Changed: ' || NEW.username,
        'Role for user ' || NEW.username || ' changed from ' || OLD.role || ' to ' || NEW.role,
        jsonb_build_object('user_id', NEW.id, 'old_role', OLD.role, 'new_role', NEW.role)
      );
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.security_alerts (alert_type, severity, title, description, metadata)
      VALUES (
        'ACCOUNT_STATUS_CHANGED',
        'medium',
        'Account ' || NEW.username || ' is now ' || NEW.status,
        'Account status transitioned from ' || OLD.status || ' to ' || NEW.status,
        jsonb_build_object('user_id', NEW.id, 'status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_users_alert ON public.app_users;
CREATE TRIGGER trg_app_users_alert
    AFTER INSERT OR UPDATE ON public.app_users
    FOR EACH ROW EXECUTE FUNCTION public.trg_app_users_security_alert();

-- ============================================================
-- 6. SESSION CONTEXT RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_session_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_require_mfa BOOLEAN := FALSE;
  v_aal TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, username, designation, role, status, linked_member_reg_no
  INTO v_profile
  FROM public.app_users
  WHERE id = v_user_id;

  IF v_profile IS NULL OR v_profile.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive_or_missing');
  END IF;

  v_aal := auth.jwt() ->> 'aal';

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_profile.id,
    'username', v_profile.username,
    'designation', v_profile.designation,
    'role', v_profile.role,
    'status', v_profile.status,
    'linked_member_reg_no', v_profile.linked_member_reg_no,
    'aal', v_aal,
    'require_mfa', v_require_mfa
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_session_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_session_context() TO authenticated;

-- ============================================================
-- 7. LOCK DOWN ANON ROLE
-- ============================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

COMMIT;
