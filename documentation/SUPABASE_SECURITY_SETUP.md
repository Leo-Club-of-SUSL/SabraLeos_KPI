# Supabase Security Setup

Run these SQL blocks in Supabase SQL Editor before going live.

## Enable RLS
ALTER TABLE public.members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users     ENABLE ROW LEVEL SECURITY;

## Helper: get current user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::text FROM public.app_users WHERE id = auth.uid();
$$;

## members policies
CREATE POLICY "members_select" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert" ON public.members FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "members_update" ON public.members FOR UPDATE TO authenticated USING (public.get_my_role() IN ('super_admin','editor')) WITH CHECK (public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "members_delete" ON public.members FOR DELETE TO authenticated USING (public.get_my_role() = 'super_admin');

## contributions policies
CREATE POLICY "contributions_select" ON public.contributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "contributions_insert" ON public.contributions FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "contributions_update" ON public.contributions FOR UPDATE TO authenticated USING (public.get_my_role() = 'super_admin' OR (public.get_my_role() = 'editor' AND added_by = auth.uid())) WITH CHECK (public.get_my_role() = 'super_admin' OR (public.get_my_role() = 'editor' AND added_by = auth.uid()));
CREATE POLICY "contributions_delete" ON public.contributions FOR DELETE TO authenticated USING (public.get_my_role() = 'super_admin');

## app_users policies
CREATE POLICY "app_users_select" ON public.app_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_users_insert" ON public.app_users FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'super_admin');
CREATE POLICY "app_users_update" ON public.app_users FOR UPDATE TO authenticated USING (public.get_my_role() = 'super_admin' OR id = auth.uid()) WITH CHECK (public.get_my_role() = 'super_admin' OR id = auth.uid());
CREATE POLICY "app_users_delete" ON public.app_users FOR DELETE TO authenticated USING (public.get_my_role() = 'super_admin');

## Storage: members bucket policies
CREATE POLICY "storage_members_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'members');
CREATE POLICY "storage_members_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'members' AND public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "storage_members_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'members' AND public.get_my_role() = 'super_admin');

## Points recalculation trigger
CREATE OR REPLACE FUNCTION public.recalculate_member_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE target_reg_no TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN target_reg_no := OLD.member_reg_no;
  ELSE target_reg_no := NEW.member_reg_no; END IF;
  UPDATE public.members
  SET total_points = COALESCE((SELECT SUM(points) FROM public.contributions WHERE member_reg_no = target_reg_no), 0),
      updated_at = NOW()
  WHERE reg_no = target_reg_no;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_recalculate_points ON public.contributions;
CREATE TRIGGER trg_recalculate_points
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_member_points();

## Netlify environment variables to set
VITE_SUPABASE_URL = your Supabase project URL
VITE_SUPABASE_ANON_KEY = your anon key
NEVER add the service_role key to Netlify.

## Supabase Auth settings
- Site URL: your Netlify URL
- Redirect URLs: https://your-site.netlify.app/**
- Disable email confirmation (internal tool)
- Set members storage bucket to Private
