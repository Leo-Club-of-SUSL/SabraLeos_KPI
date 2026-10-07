-- ============================================================================
-- Nexus KPI - Synthetic Performance Data Generator (Seed Script)
-- Generates synthetic benchmark data at 3 distinct operational scales:
--   Scale 1 (Small):   300 Members,    3,000 Contributions
--   Scale 2 (Medium):  1,500 Members, 30,000 Contributions
--   Scale 3 (Large):   5,000 Members, 200,000 Contributions
-- ============================================================================
-- NOTE: Never run against production. Use only on local Supabase / isolated staging.
-- All data is completely synthetic with randomized, realistic distributions.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.perf_seed_scale(p_target_scale INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_member_count INT;
    v_contrib_count INT;
    v_admin_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    v_editor_id UUID := '00000000-0000-0000-0000-000000000002'::uuid;
    v_viewer_id UUID := '00000000-0000-0000-0000-000000000003'::uuid;
    v_member_user_id UUID := '00000000-0000-0000-0000-000000000004'::uuid;
BEGIN
    IF p_target_scale = 1 THEN
        v_member_count := 300;
        v_contrib_count := 3000;
    ELSIF p_target_scale = 2 THEN
        v_member_count := 1500;
        v_contrib_count := 30000;
    ELSIF p_target_scale = 3 THEN
        v_member_count := 5000;
        v_contrib_count := 200000;
    ELSE
        RAISE EXCEPTION 'Scale must be 1 (300/3K), 2 (1.5K/30K), or 3 (5K/200K)';
    END IF;

    RAISE NOTICE 'Seeding Scale %: % Members, % Contributions...', p_target_scale, v_member_count, v_contrib_count;

    -- Clean existing test data safely
    TRUNCATE TABLE public.security_events CASCADE;
    TRUNCATE TABLE public.security_alerts CASCADE;
    TRUNCATE TABLE public.system_logs CASCADE;
    TRUNCATE TABLE public.contributions CASCADE;
    TRUNCATE TABLE public.app_users CASCADE;
    TRUNCATE TABLE public.members CASCADE;
    TRUNCATE TABLE public.faculties CASCADE;
    TRUNCATE TABLE public.batches CASCADE;
    TRUNCATE TABLE public.avenues CASCADE;

    -- 1. Seed Taxonomies
    INSERT INTO public.faculties (name) VALUES
        ('Faculty of Computing'),
        ('Faculty of Applied Sciences'),
        ('Faculty of Management Studies'),
        ('Faculty of Social Sciences and Languages'),
        ('Faculty of Agricultural Sciences'),
        ('Faculty of Geomatics'),
        ('Faculty of Medicine'),
        ('Faculty of Technology');

    INSERT INTO public.batches (name) VALUES
        ('2019/2020'), ('2020/2021'), ('2021/2022'), ('2022/2023'), ('2023/2024');

    INSERT INTO public.avenues (name) VALUES
        ('Leadership Development'),
        ('Community Service'),
        ('Environmental Protection'),
        ('Health and Nutrition'),
        ('Youth Empowerment'),
        ('Sports and Recreation'),
        ('International Relations');

    -- 2. Seed Members
    -- Disable audit & recalculation triggers during bulk population for speed
    ALTER TABLE public.members DISABLE TRIGGER trg_audit_members;
    ALTER TABLE public.contributions DISABLE TRIGGER trg_audit_contributions;
    ALTER TABLE public.contributions DISABLE TRIGGER trg_recalculate_points;
    ALTER TABLE public.contributions DISABLE TRIGGER trg_guard_self_award;

    INSERT INTO public.members (
        reg_no, full_name, name_with_initials, my_lci_num, batch, faculty, whatsapp, email, member_status, leaderboard_opt_out, display_alias, total_points, created_at
    )
    SELECT
        '22ABC' || LPAD(i::text, 5, '0'),
        'Synthetic Member Full Name ' || i,
        'S. M. ' || i,
        'LCI' || LPAD(i::text, 6, '0'),
        (ARRAY['2019/2020', '2020/2021', '2021/2022', '2022/2023', '2023/2024'])[1 + (i % 5)],
        (ARRAY['Faculty of Computing', 'Faculty of Applied Sciences', 'Faculty of Management Studies', 'Faculty of Social Sciences and Languages', 'Faculty of Agricultural Sciences', 'Faculty of Geomatics', 'Faculty of Medicine', 'Faculty of Technology'])[1 + (i % 8)],
        '+9477' || LPAD(i::text, 7, '0'),
        'member_' || LPAD(i::text, 5, '0') || '@test.leoclubsusl.lk',
        CASE WHEN (i % 10 = 0) THEN 'alumni' ELSE 'active' END,
        CASE WHEN (i % 15 = 0) THEN true ELSE false END,
        CASE WHEN (i % 15 = 0) THEN 'Anonymous Leo ' || i ELSE NULL END,
        0, -- recalculated after contribution population
        NOW() - (i || ' hours')::interval
    FROM generate_series(1, v_member_count) i;

    -- 3. Seed Benchmark App Users
    INSERT INTO public.app_users (id, username, designation, role, status, linked_member_reg_no) VALUES
        (v_admin_id, 'admin_perf', 'President', 'super_admin', 'active', '22ABC00001'),
        (v_editor_id, 'editor_perf', 'Secretary', 'editor', 'active', '22ABC00002'),
        (v_viewer_id, 'viewer_perf', 'Advisor', 'viewer', 'active', '22ABC00003'),
        (v_member_user_id, 'member_perf', 'Club Member', 'member', 'active', '22ABC00010')
    ON CONFLICT (id) DO NOTHING;

    -- 4. Seed Contributions with Realistic Distribution (Zipfian/Skewed)
    INSERT INTO public.contributions (
        id, member_reg_no, project_name, time_period, position, points, avenue, date_added, added_by
    )
    SELECT
        gen_random_uuid(),
        -- Skew distribution: 20% of members get 80% of contributions
        '22ABC' || LPAD((1 + floor(power(random(), 2.5) * v_member_count))::text, 5, '0'),
        'Project Alpha ' || (1 + (j % 50)),
        to_char(NOW() - ((j % 365) || ' days')::interval, 'YYYY-MM'),
        (ARRAY['Project Chairperson', 'Committee Member', 'Volunteer', 'Lead Organizer', 'Treasurer'])[1 + (j % 5)],
        (ARRAY[5, 10, 15, 20, 25, 30, 50, 75, 100])[1 + (j % 9)],
        (ARRAY['Leadership Development', 'Community Service', 'Environmental Protection', 'Health and Nutrition', 'Youth Empowerment', 'Sports and Recreation', 'International Relations'])[1 + (j % 7)],
        NOW() - ((j % 365) || ' days')::interval,
        v_editor_id
    FROM generate_series(1, v_contrib_count) j;

    -- 5. Recompute aggregated total points per member in bulk
    UPDATE public.members m
    SET total_points = COALESCE(sub.sum_pts, 0)
    FROM (
        SELECT member_reg_no, SUM(points) AS sum_pts
        FROM public.contributions
        GROUP BY member_reg_no
    ) sub
    WHERE m.reg_no = sub.member_reg_no;

    -- Re-enable triggers
    ALTER TABLE public.members ENABLE TRIGGER trg_audit_members;
    ALTER TABLE public.contributions ENABLE TRIGGER trg_audit_contributions;
    ALTER TABLE public.contributions ENABLE TRIGGER trg_recalculate_points;
    ALTER TABLE public.contributions ENABLE TRIGGER trg_guard_self_award;

    -- Run ANALYZE to update PostgreSQL optimizer statistics
    ANALYZE public.members;
    ANALYZE public.contributions;
    ANALYZE public.app_users;
    ANALYZE public.faculties;
    ANALYZE public.batches;
    ANALYZE public.avenues;

    RAISE NOTICE 'Scale % Seeding Completed Successfully.', p_target_scale;
END;
$$;
