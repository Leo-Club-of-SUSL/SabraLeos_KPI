-- Nexus KPI System - Complete Supabase Schema
-- This script sets up the tables, triggers, and Row Level Security (RLS) policies.

-- 1. Create Tables
-- ==========================================

-- Members Table
CREATE TABLE IF NOT EXISTS public.members (
    reg_no TEXT PRIMARY KEY,
    photo_url TEXT,
    full_name TEXT NOT NULL,
    name_with_initials TEXT NOT NULL,
    my_lci_num TEXT,
    batch TEXT NOT NULL,
    faculty TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    total_points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contributions Table
CREATE TABLE IF NOT EXISTS public.contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_reg_no TEXT REFERENCES public.members(reg_no) ON DELETE CASCADE NOT NULL,
    project_name TEXT NOT NULL,
    time_period TEXT NOT NULL, -- Format: YYYY-MM
    position TEXT NOT NULL,
    points INTEGER NOT NULL,
    avenue TEXT,
    date_added TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- App Users Table (Profiles)
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    designation TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'editor', 'viewer')),
    linked_member_reg_no TEXT REFERENCES public.members(reg_no) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculties Table
CREATE TABLE IF NOT EXISTS public.faculties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batches Table
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Avenues Table
CREATE TABLE IF NOT EXISTS public.avenues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Logs Table
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    details JSONB,
    entity_type TEXT,
    entity_id TEXT
);

-- 2. Security Setup (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get the current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::text FROM public.app_users WHERE id = auth.uid();
$$;

-- Members Policies
CREATE POLICY "members_select" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert" ON public.members FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "members_update" ON public.members FOR UPDATE TO authenticated USING (public.get_my_role() IN ('super_admin','editor')) WITH CHECK (public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "members_delete" ON public.members FOR DELETE TO authenticated USING (public.get_my_role() IN ('super_admin','editor'));

-- Contributions Policies
CREATE POLICY "contributions_select" ON public.contributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "contributions_insert" ON public.contributions FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "contributions_update" ON public.contributions FOR UPDATE TO authenticated USING (public.get_my_role() = 'super_admin' OR (public.get_my_role() = 'editor' AND added_by = auth.uid())) WITH CHECK (public.get_my_role() = 'super_admin' OR (public.get_my_role() = 'editor' AND added_by = auth.uid()));
CREATE POLICY "contributions_delete" ON public.contributions FOR DELETE TO authenticated USING (public.get_my_role() = 'super_admin');

-- App Users Policies
CREATE POLICY "app_users_select" ON public.app_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_users_insert" ON public.app_users FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'super_admin');
CREATE POLICY "app_users_update" ON public.app_users FOR UPDATE TO authenticated USING (public.get_my_role() = 'super_admin' OR id = auth.uid()) WITH CHECK (public.get_my_role() = 'super_admin' OR id = auth.uid());
CREATE POLICY "app_users_delete" ON public.app_users FOR DELETE TO authenticated USING (public.get_my_role() = 'super_admin');

-- Faculties Policies
CREATE POLICY "faculties_select" ON public.faculties FOR SELECT TO authenticated USING (true);
CREATE POLICY "faculties_all" ON public.faculties FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin','editor')) WITH CHECK (public.get_my_role() IN ('super_admin','editor'));

-- Batches Policies
CREATE POLICY "batches_select" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batches_all" ON public.batches FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin','editor')) WITH CHECK (public.get_my_role() IN ('super_admin','editor'));

-- Avenues Policies
CREATE POLICY "avenues_select" ON public.avenues FOR SELECT TO authenticated USING (true);
CREATE POLICY "avenues_all" ON public.avenues FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin','editor')) WITH CHECK (public.get_my_role() IN ('super_admin','editor'));

-- System Logs Policies
CREATE POLICY "system_logs_select" ON public.system_logs FOR SELECT TO authenticated USING (public.get_my_role() IN ('super_admin', 'editor'));
CREATE POLICY "system_logs_insert" ON public.system_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Storage Policies
-- IMPORTANT: The 'members' bucket MUST be set to PUBLIC in the Supabase dashboard
--   Storage → Buckets → members → Edit → toggle "Public bucket" ON
-- Then run the following SQL to set the correct RLS policies on storage.objects:

-- Allow anyone (including anonymous) to VIEW photos (required for img src / getPublicUrl)
CREATE POLICY "storage_members_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'members');

-- Allow authenticated editors/super_admins to UPLOAD photos
CREATE POLICY "storage_members_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'members' AND public.get_my_role() IN ('super_admin', 'editor'));

-- Allow authenticated editors/super_admins to UPDATE (replace) photos
CREATE POLICY "storage_members_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'members' AND public.get_my_role() IN ('super_admin', 'editor'));

-- Allow super_admins to DELETE photos
CREATE POLICY "storage_members_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'members' AND public.get_my_role() = 'super_admin');

-- 3. Triggers & Functions
-- ==========================================

-- Function to recalculate total points for a member
CREATE OR REPLACE FUNCTION public.recalculate_member_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
    target_reg_no TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN 
        target_reg_no := OLD.member_reg_no;
    ELSE 
        target_reg_no := NEW.member_reg_no; 
    END IF;

    UPDATE public.members
    SET total_points = COALESCE((SELECT SUM(points) FROM public.contributions WHERE member_reg_no = target_reg_no), 0),
        updated_at = NOW()
    WHERE reg_no = target_reg_no;

    RETURN COALESCE(NEW, OLD);
END; 
$$;

-- Trigger to recalculate points after contribution changes
DROP TRIGGER IF EXISTS trg_recalculate_points ON public.contributions;
CREATE TRIGGER trg_recalculate_points
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_member_points();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at on members
CREATE TRIGGER update_members_updated_at
    BEFORE UPDATE ON public.members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Auto-delete member accounts from auth.users when member is deleted
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
  IF TG_OP = 'DELETE' THEN
    v_reg_no := OLD.reg_no;
  ELSIF TG_OP = 'UPDATE' THEN
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

  FOR v_user_record IN (
    SELECT id, role
    FROM public.app_users
    WHERE UPPER(TRIM(linked_member_reg_no)) = UPPER(TRIM(v_reg_no))
       OR UPPER(TRIM(username)) = UPPER(TRIM(v_reg_no))
  ) LOOP
    IF v_user_record.role IN ('super_admin', 'editor') THEN
      UPDATE public.app_users
      SET linked_member_reg_no = NULL
      WHERE id = v_user_record.id;
    ELSE
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

DROP TRIGGER IF EXISTS trg_member_account_auto_delete_delete ON public.members;
CREATE TRIGGER trg_member_account_auto_delete_delete
  BEFORE DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_account_auto_delete();

DROP TRIGGER IF EXISTS trg_member_account_auto_delete_soft ON public.members;
CREATE TRIGGER trg_member_account_auto_delete_soft
  AFTER UPDATE OF deleted_at ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_account_auto_delete();


-- Migration: 20261010000001_fix_security_alerts_and_login_logging.sql
-- Description:
--   1. Add resolve_security_alert() RPC supporting 'resolved', 'ignored', and 'active' (reopen)
--   2. Fix log_login() to reliably log user logins to both system_logs and security_events with actor_username
--   3. Fix log_logout() to attach actor_username
--   4. Fix log_security_event() to look up actor_username for the calling actor and avoid misattributing target username
--   5. Update audit_log_trigger() to include actor_username in details payload

-- ============================================================
-- 1. SECURITY ALERT RESOLUTION & DISMISSAL (IGNORE / RESOLVE / REOPEN)
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_security_alert(
  p_alert_id UUID,
  p_action TEXT DEFAULT 'resolved'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verify caller is an officer / super admin
  SELECT role::text INTO v_role
  FROM public.app_users
  WHERE id = auth.uid()
    AND COALESCE(status, 'active') = 'active';

  IF v_role NOT IN ('editor', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: officer privileges required'
      USING ERRCODE = '42501';
  END IF;

  IF p_action = 'active' THEN
    -- Re-opening an alert
    UPDATE public.security_alerts
    SET
      is_resolved = FALSE,
      resolved_by = NULL,
      resolved_at = NULL,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'status', 'active',
        'is_ignored', false,
        'reopened_at', NOW()
      )
    WHERE id = p_alert_id;
  ELSE
    -- Resolving or ignoring an alert
    UPDATE public.security_alerts
    SET
      is_resolved = TRUE,
      resolved_by = auth.uid(),
      resolved_at = NOW(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'status', p_action,
        'is_ignored', (p_action = 'ignored'),
        'action_at', NOW()
      )
    WHERE id = p_alert_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_security_alert(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resolve_security_alert(UUID, TEXT) TO authenticated;

-- ============================================================
-- 2. FIX log_login() TO LOG SYMMETRICALLY TO BOTH LOG STREAMS
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_login()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_username TEXT;
  v_user_id  UUID;
  v_role     TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- 1. Look up profile from app_users
  SELECT role::text, username INTO v_role, v_username
  FROM public.app_users
  WHERE id = v_user_id
    AND COALESCE(status, 'active') = 'active';

  -- Fallback username from auth.users email prefix if not in app_users
  IF v_username IS NULL THEN
    SELECT split_part(email, '@', 1) INTO v_username
    FROM auth.users
    WHERE id = v_user_id;
  END IF;

  IF v_username IS NULL THEN
    v_username := 'User';
  END IF;

  -- 2. Debounce: Skip if LOGIN was already logged within 15 seconds
  IF EXISTS (
    SELECT 1 FROM public.system_logs
    WHERE user_id = v_user_id
      AND action = 'LOGIN'
      AND (
        (created_at IS NOT NULL AND created_at > NOW() - INTERVAL '15 seconds') OR
        (timestamp IS NOT NULL AND timestamp > NOW() - INTERVAL '15 seconds')
      )
  ) THEN
    RETURN;
  END IF;

  -- 3. Insert into activity log (system_logs)
  INSERT INTO public.system_logs (
    user_id,
    user_name,
    action,
    details,
    entity_type,
    entity_id,
    timestamp,
    created_at
  )
  VALUES (
    v_user_id,
    v_username,
    'LOGIN',
    jsonb_build_object(
      'method', 'password',
      'username', v_username,
      'actor_username', v_username,
      'role', COALESCE(v_role, 'member')
    ),
    'session',
    v_user_id::text,
    NOW(),
    NOW()
  );

  -- 4. Insert into security events stream (security_events)
  INSERT INTO public.security_events (
    event_type,
    user_id,
    actor_id,
    details,
    created_at
  )
  VALUES (
    'LOGIN',
    v_user_id,
    v_user_id,
    jsonb_build_object(
      'method', 'password',
      'username', v_username,
      'actor_username', v_username,
      'role', COALESCE(v_role, 'member')
    ),
    NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_login() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_login() TO authenticated;

-- ============================================================
-- 3. FIX log_logout() TO ATTACH actor_username
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_logout()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_username TEXT;
  v_user_id  UUID;
  v_role     TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT role::text, username INTO v_role, v_username
  FROM public.app_users
  WHERE id = v_user_id
    AND COALESCE(status, 'active') = 'active';

  IF v_username IS NULL THEN
    SELECT split_part(email, '@', 1) INTO v_username
    FROM auth.users
    WHERE id = v_user_id;
  END IF;

  IF v_username IS NULL THEN
    v_username := 'User';
  END IF;

  -- Debounce: Skip if already logged logout within 15 seconds
  IF EXISTS (
    SELECT 1 FROM public.system_logs
    WHERE user_id = v_user_id
      AND action = 'LOGOUT'
      AND (
        (created_at IS NOT NULL AND created_at > NOW() - INTERVAL '15 seconds') OR
        (timestamp IS NOT NULL AND timestamp > NOW() - INTERVAL '15 seconds')
      )
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.system_logs (
    user_id,
    user_name,
    action,
    details,
    entity_type,
    entity_id,
    timestamp,
    created_at
  )
  VALUES (
    v_user_id,
    v_username,
    'LOGOUT',
    jsonb_build_object(
      'method', 'manual',
      'username', v_username,
      'actor_username', v_username,
      'role', COALESCE(v_role, 'member')
    ),
    'session',
    v_user_id::text,
    NOW(),
    NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_logout() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_logout() TO authenticated;

-- ============================================================
-- 4. FIX log_security_event() TO PRESERVE ACTOR IDENTITY
-- ============================================================

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
DECLARE
  v_actor_id        UUID;
  v_effective_actor UUID;
  v_actor_username  TEXT;
  v_target_username TEXT;
  v_details         JSONB;
BEGIN
  v_actor_id        := auth.uid();
  v_effective_actor := COALESCE(v_actor_id, p_target_user_id);
  v_details         := COALESCE(p_details, '{}'::jsonb);

  -- 1. Identify actor username from app_users
  IF v_effective_actor IS NOT NULL THEN
    SELECT username INTO v_actor_username
    FROM public.app_users
    WHERE id = v_effective_actor;

    IF v_actor_username IS NULL THEN
      SELECT split_part(email, '@', 1) INTO v_actor_username
      FROM auth.users
      WHERE id = v_effective_actor;
    END IF;
  END IF;

  -- 2. Inject actor_username if not explicitly passed
  IF NOT (v_details ? 'actor_username') AND v_actor_username IS NOT NULL THEN
    v_details := v_details || jsonb_build_object('actor_username', v_actor_username);
  END IF;

  -- 3. If target user provided, extract target username
  IF p_target_user_id IS NOT NULL AND NOT (v_details ? 'target_username') THEN
    SELECT username INTO v_target_username
    FROM public.app_users
    WHERE id = p_target_user_id;

    IF v_target_username IS NOT NULL THEN
      v_details := v_details || jsonb_build_object('target_username', v_target_username);
    END IF;
  END IF;

  -- 4. Insert security event record
  INSERT INTO public.security_events (
    event_type,
    user_id,
    actor_id,
    details,
    created_at
  )
  VALUES (
    p_event_type,
    COALESCE(p_target_user_id, v_actor_id),
    v_effective_actor,
    v_details,
    NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_security_event(TEXT, UUID, JSONB) TO authenticated, anon;

-- ============================================================
-- 5. UPDATE audit_log_trigger() TO ATTACH actor_username
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

  IF v_user_id IS NOT NULL THEN
    SELECT username INTO v_username
    FROM public.app_users
    WHERE id = v_user_id;

    IF v_username IS NULL THEN
      SELECT split_part(email, '@', 1) INTO v_username
      FROM auth.users
      WHERE id = v_user_id;
    END IF;
  END IF;

  IF v_username IS NULL THEN
    v_username := 'System';
  END IF;

  CASE TG_OP
    WHEN 'INSERT' THEN
      v_action  := 'CREATE_' || upper(TG_TABLE_NAME);
      v_entity_id := CASE TG_TABLE_NAME
                       WHEN 'members'       THEN (row_to_json(NEW)->>'reg_no')
                       WHEN 'contributions' THEN (row_to_json(NEW)->>'id')
                       ELSE (row_to_json(NEW)->>'id')
                     END;
      v_details := to_jsonb(NEW);
    WHEN 'UPDATE' THEN
      v_action  := 'UPDATE_' || upper(TG_TABLE_NAME);
      v_entity_id := CASE TG_TABLE_NAME
                       WHEN 'members'       THEN (row_to_json(NEW)->>'reg_no')
                       WHEN 'contributions' THEN (row_to_json(NEW)->>'id')
                       ELSE (row_to_json(NEW)->>'id')
                     END;
      v_details := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
    WHEN 'DELETE' THEN
      v_action  := 'DELETE_' || upper(TG_TABLE_NAME);
      v_entity_id := CASE TG_TABLE_NAME
                       WHEN 'members'       THEN (row_to_json(OLD)->>'reg_no')
                       WHEN 'contributions' THEN (row_to_json(OLD)->>'id')
                       ELSE (row_to_json(OLD)->>'id')
                     END;
      v_details := to_jsonb(OLD);
  END CASE;

  -- Strip sensitive fields from details before logging
  v_details := (v_details
    - 'whatsapp'
    - 'email'
    - 'my_lci_num')
    || jsonb_build_object('actor_username', v_username);

  INSERT INTO public.system_logs (
    user_id,
    user_name,
    action,
    details,
    entity_type,
    entity_id,
    timestamp,
    created_at
  )
  VALUES (
    v_user_id,
    v_username,
    v_action,
    v_details,
    TG_TABLE_NAME,
    v_entity_id,
    NOW(),
    NOW()
  );

  RETURN NULL;
END;
$$;
