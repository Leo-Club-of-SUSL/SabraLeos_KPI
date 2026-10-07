-- ============================================================
-- Migration: 20261007000002_merge_session_context_rpc.sql
-- Description: 
--   1. Bump schema version to 2026.10.07.1
--   2. Extend get_my_session_context() to return complete AppUser fields (created_at, updated_at)
-- ============================================================

BEGIN;

-- 1. Schema version record
CREATE TABLE IF NOT EXISTS public.schema_meta (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    description TEXT
);

INSERT INTO public.schema_meta (version, description)
VALUES ('2026.10.07.1', 'Merged session context RPC and performance optimizations')
ON CONFLICT (version) DO NOTHING;

-- 2. Extended session context RPC
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

  SELECT id, username, designation, role, status, linked_member_reg_no, created_at, updated_at
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
    'created_at', v_profile.created_at,
    'updated_at', v_profile.updated_at,
    'aal', v_aal,
    'require_mfa', v_require_mfa
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_session_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_session_context() TO authenticated;

COMMIT;
