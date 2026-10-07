-- Migration: 20261006000001_system_settings.sql
-- Description: System settings table for configurable application settings like tier thresholds
-- Rollback: DROP TABLE IF EXISTS public.system_settings;

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone authenticated can read system settings
DROP POLICY IF EXISTS "Allow authenticated users to read system settings" ON public.system_settings;
CREATE POLICY "Allow authenticated users to read system settings"
    ON public.system_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Only super_admin can insert/update/delete system settings
DROP POLICY IF EXISTS "Allow super_admin to manage system settings" ON public.system_settings;
CREATE POLICY "Allow super_admin to manage system settings"
    ON public.system_settings
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Seed default tier thresholds
INSERT INTO public.system_settings (key, value)
VALUES (
    'tier_thresholds',
    '{"prospect": 0, "official": 50, "bronze": 150, "silver": 300, "gold": 500, "platinum": 800}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
