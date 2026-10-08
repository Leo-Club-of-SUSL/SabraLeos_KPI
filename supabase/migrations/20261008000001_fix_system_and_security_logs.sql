-- ============================================================
-- Migration: 20261008000001_fix_system_and_security_logs.sql
-- Description: Unifies system_logs and security_events schema,
--              fixes status handling in get_my_role(), ensures
--              audit triggers & RPCs log reliably, and aligns RLS.
-- ============================================================

-- 1. Ensure public.system_logs exists and has both timestamp & created_at
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    details JSONB,
    old_value TEXT,
    new_value TEXT,
    entity_type TEXT,
    entity_id TEXT
);

-- Ensure all columns exist regardless of legacy state
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- Backfill timestamps if one was null
UPDATE public.system_logs SET created_at = timestamp WHERE created_at IS NULL AND timestamp IS NOT NULL;
UPDATE public.system_logs SET timestamp = created_at WHERE timestamp IS NULL AND created_at IS NOT NULL;

-- 2. Ensure public.security_events exists and has all columns
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON public.system_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON public.system_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events (user_id);

-- 4. Helper function: get_my_role() (treats NULL status as active)
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
    AND COALESCE(status, 'active') = 'active';
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

-- 5. RPC: log_login()
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

  SELECT role::text, username INTO v_role, v_username
  FROM public.app_users
  WHERE id = v_user_id
    AND COALESCE(status, 'active') = 'active';

  -- Only log officer logins
  IF v_role NOT IN ('viewer', 'editor', 'super_admin') THEN
    RETURN;
  END IF;

  -- Debounce: Don't insert duplicate LOGIN log within 15 seconds
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
    COALESCE(v_username, 'Officer'),
    'LOGIN',
    '{"method":"password"}'::jsonb,
    'session',
    v_user_id::text,
    NOW(),
    NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_login() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_login() TO authenticated;

-- 5b. RPC: log_logout()
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

  -- Only log officer logouts
  IF v_role NOT IN ('viewer', 'editor', 'super_admin') THEN
    RETURN;
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
    COALESCE(v_username, 'Officer'),
    'LOGOUT',
    '{"method":"manual"}'::jsonb,
    'session',
    v_user_id::text,
    NOW(),
    NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_logout() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_logout() TO authenticated;

-- 6. RPC: log_export()
CREATE OR REPLACE FUNCTION public.log_export(p_details JSONB)
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

  IF v_role NOT IN ('viewer', 'editor', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: only officers may log exports'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.system_logs (
    user_id,
    user_name,
    action,
    details,
    entity_type,
    timestamp,
    created_at
  )
  VALUES (
    v_user_id,
    COALESCE(v_username, 'Officer'),
    'EXPORT',
    p_details,
    'export',
    NOW(),
    NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_export(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_export(JSONB) TO authenticated;

-- 7. RPC: log_security_event()
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
  v_username        TEXT;
  v_details         JSONB;
BEGIN
  v_actor_id        := auth.uid();
  v_effective_actor := COALESCE(v_actor_id, p_target_user_id);
  v_details         := COALESCE(p_details, '{}'::jsonb);

  -- Always extract or find the username
  IF NOT (v_details ? 'username') AND v_effective_actor IS NOT NULL THEN
    SELECT username INTO v_username
    FROM public.app_users
    WHERE id = v_effective_actor;

    IF v_username IS NOT NULL THEN
      v_details := v_details || jsonb_build_object('username', v_username);
    END IF;
  END IF;

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

-- 8. Audit Trigger for automatic data mutations (members, contributions, app_users)
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
  v_details := v_details
    - 'whatsapp'
    - 'email'
    - 'my_lci_num';

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
    COALESCE(v_username, 'System'),
    v_action,
    v_details,
    TG_TABLE_NAME,
    v_entity_id,
    NOW(),
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit triggers
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

-- 9. Row Level Security policies
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_logs_select_officer" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_select_super_admin" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_select" ON public.system_logs;

CREATE POLICY "system_logs_select_officer"
  ON public.system_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE id = auth.uid()
        AND role IN ('viewer', 'editor', 'super_admin')
        AND COALESCE(status, 'active') = 'active'
    )
  );

DROP POLICY IF EXISTS "security_events_select_officer" ON public.security_events;
DROP POLICY IF EXISTS "security_events_select_super_admin" ON public.security_events;
DROP POLICY IF EXISTS "security_events_select" ON public.security_events;

CREATE POLICY "security_events_select_officer"
  ON public.security_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE id = auth.uid()
        AND role IN ('viewer', 'editor', 'super_admin')
        AND COALESCE(status, 'active') = 'active'
    )
  );

-- 10. Backfill existing historical records to fix legacy "Security Guardian" / missing usernames
UPDATE public.security_events se
SET actor_id = COALESCE(se.actor_id, se.user_id),
    details = COALESCE(se.details, '{}'::jsonb) || jsonb_build_object('username', au.username)
FROM public.app_users au
WHERE (se.user_id = au.id OR se.actor_id = au.id)
  AND (se.actor_id IS NULL OR se.details IS NULL OR NOT (se.details ? 'username'));

-- 11. Cleanup existing duplicate LOGIN entries in system_logs (keep newest)
DELETE FROM public.system_logs a
USING public.system_logs b
WHERE a.id < b.id
  AND a.action = 'LOGIN'
  AND b.action = 'LOGIN'
  AND a.user_id = b.user_id
  AND ABS(EXTRACT(EPOCH FROM (COALESCE(a.created_at, a.timestamp) - COALESCE(b.created_at, b.timestamp)))) < 10;

