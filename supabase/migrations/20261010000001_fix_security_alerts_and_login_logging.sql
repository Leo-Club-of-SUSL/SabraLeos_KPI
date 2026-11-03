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
