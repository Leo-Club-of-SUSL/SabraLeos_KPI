-- Migration: 20261007000001_allow_member_role.sql
-- Allow 'member' role in app_users check constraint for self-service portal accounts

ALTER TABLE public.app_users
  DROP CONSTRAINT IF EXISTS app_users_role_check;

ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('super_admin', 'editor', 'viewer', 'member'));
