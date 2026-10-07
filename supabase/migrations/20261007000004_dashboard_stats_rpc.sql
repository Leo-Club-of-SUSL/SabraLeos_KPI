-- ============================================================
-- Migration: 20261007000004_dashboard_stats_rpc.sql
-- Description:
--   Add get_dashboard_stats() RPC for officer overview totals
--   Computes active member count and total points on server with strict role checks.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member_count BIGINT;
  v_total_points BIGINT;
BEGIN
  -- Security check: Fail closed with 42501 unless caller is an officer (viewer, editor, super_admin)
  IF NOT (SELECT public.is_officer()) THEN
    RAISE EXCEPTION 'Access denied: officer role required' USING ERRCODE = '42501';
  END IF;

  -- Compute active non-deleted member count
  SELECT COUNT(*)
  INTO v_member_count
  FROM public.members
  WHERE deleted_at IS NULL;

  -- Compute total points across all non-deleted members
  SELECT COALESCE(SUM(total_points), 0)
  INTO v_total_points
  FROM public.members
  WHERE deleted_at IS NULL;

  RETURN jsonb_build_object(
    'member_count', v_member_count,
    'total_points', v_total_points
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

COMMIT;
