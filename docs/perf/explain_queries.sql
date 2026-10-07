-- ============================================================================
-- Nexus KPI - Benchmark EXPLAIN (ANALYZE, BUFFERS) Test Harness
-- Measures execution time, buffer hits, seq scan vs index scan, and RLS overhead.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Test 1: Dashboard Total Points (contributionService.getTotalPoints)
-- Problem: Fetches entire contributions table into JS to sum points
-- ----------------------------------------------------------------------------
-- As postgres (Bypass RLS baseline):
EXPLAIN (ANALYZE, BUFFERS)
SELECT points FROM public.contributions;

-- As authenticated officer (With RLS):
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
EXPLAIN (ANALYZE, BUFFERS)
SELECT points FROM public.contributions;
ROLLBACK;


-- ----------------------------------------------------------------------------
-- Test 2: Members List All (memberService.getAll)
-- Problem: SELECT * without LIMIT, sorts by unindexed total_points
-- ----------------------------------------------------------------------------
-- As postgres:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.members WHERE deleted_at IS NULL ORDER BY total_points DESC;

-- As authenticated officer:
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.members WHERE deleted_at IS NULL ORDER BY total_points DESC;
ROLLBACK;


-- ----------------------------------------------------------------------------
-- Test 3: Member Lookup by Reg No (memberService.getByRegNo)
-- ----------------------------------------------------------------------------
-- As postgres:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.members WHERE reg_no ILIKE '22ABC00010' AND deleted_at IS NULL LIMIT 1;

-- As authenticated officer:
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.members WHERE reg_no ILIKE '22ABC00010' AND deleted_at IS NULL LIMIT 1;
ROLLBACK;


-- ----------------------------------------------------------------------------
-- Test 4: Member Contributions History (contributionService.getByMember)
-- Problem: Unindexed foreign key member_reg_no causes Seq Scan on contributions
-- ----------------------------------------------------------------------------
-- As postgres:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.contributions WHERE member_reg_no = '22ABC00010' ORDER BY date_added DESC;

-- As authenticated officer:
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.contributions WHERE member_reg_no = '22ABC00010' ORDER BY date_added DESC;
ROLLBACK;


-- ----------------------------------------------------------------------------
-- Test 5: Monthly Leaderboard (contributionService.getMonthlyLeaderboard)
-- Problem: Scans all contributions for time_period without index, aggregates in JS
-- ----------------------------------------------------------------------------
-- As postgres:
EXPLAIN (ANALYZE, BUFFERS)
SELECT member_reg_no, points FROM public.contributions WHERE time_period = '2026-03';

-- As authenticated officer:
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
EXPLAIN (ANALYZE, BUFFERS)
SELECT member_reg_no, points FROM public.contributions WHERE time_period = '2026-03';
ROLLBACK;


-- ----------------------------------------------------------------------------
-- Test 6: Reports Data Load (Reports.tsx - contributions.getAll)
-- Problem: Fetches entire contributions table (100% rows, SELECT *)
-- ----------------------------------------------------------------------------
-- As postgres:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.contributions ORDER BY date_added DESC;

-- As authenticated officer:
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.contributions ORDER BY date_added DESC;
ROLLBACK;


-- ----------------------------------------------------------------------------
-- Test 7: Member Search Query (memberService.search)
-- Problem: OR query with wildcards on multiple columns without trigram index
-- ----------------------------------------------------------------------------
-- As postgres:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.members
WHERE (reg_no ILIKE '%saman%' OR full_name ILIKE '%saman%' OR name_with_initials ILIKE '%saman%')
  AND deleted_at IS NULL
ORDER BY total_points DESC;

-- As authenticated officer:
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.members
WHERE (reg_no ILIKE '%saman%' OR full_name ILIKE '%saman%' OR name_with_initials ILIKE '%saman%')
  AND deleted_at IS NULL
ORDER BY total_points DESC;
ROLLBACK;


-- ----------------------------------------------------------------------------
-- Test 8: Bulk Insert of 200 Contributions (Trigger Cost Benchmark)
-- Measures overhead of per-row recalculate SUM + audit log trigger + self-award guard
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

EXPLAIN (ANALYZE, BUFFERS)
INSERT INTO public.contributions (member_reg_no, project_name, time_period, position, points, avenue, added_by)
SELECT
    '22ABC' || LPAD((1 + (k % 50))::text, 5, '0'),
    'Bulk Benchmark Event',
    '2026-03',
    'Volunteer',
    10,
    'Community Service',
    '00000000-0000-0000-0000-000000000001'::uuid
FROM generate_series(1, 200) k;

ROLLBACK;
