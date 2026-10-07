-- ============================================================================
-- Nexus KPI - Performance Diagnostic Queries (Read-Only)
-- Safe to run in Supabase SQL Editor (No DDL / No DML / Read-Only Inspection)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table Row Counts, Relation Sizes, Table Scans & Dead Tuples
-- ----------------------------------------------------------------------------
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS estimated_live_rows,
    n_dead_tup AS dead_rows,
    ROUND(n_dead_tup * 100.0 / GREATEST(n_live_tup + n_dead_tup, 1), 2) AS dead_tuple_pct,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    ROUND(idx_scan * 100.0 / GREATEST(seq_scan + idx_scan, 1), 2) AS idx_scan_ratio_pct,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_and_toast_size,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;


-- ----------------------------------------------------------------------------
-- 2A. Existing Indexes Inventory
-- ----------------------------------------------------------------------------
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ----------------------------------------------------------------------------
-- 2B. Foreign Keys Missing a Supporting Index
-- ----------------------------------------------------------------------------
WITH fk_columns AS (
    SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
),
indexed_first_cols AS (
    SELECT
        t.relname AS table_name,
        a.attname AS column_name
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ix.indkey[0]
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
)
SELECT
    fk.table_name,
    fk.column_name AS fk_column,
    fk.foreign_table_name,
    fk.foreign_column_name,
    fk.constraint_name,
    'MISSING INDEX (causes Seq Scan on parent DELETE/UPDATE and child JOINs)' AS status
FROM fk_columns fk
LEFT JOIN indexed_first_cols ifc
    ON fk.table_name = ifc.table_name
    AND fk.column_name = ifc.column_name
WHERE ifc.column_name IS NULL
ORDER BY fk.table_name, fk.column_name;


-- ----------------------------------------------------------------------------
-- 2C. Unused Indexes (idx_scan = 0)
-- ----------------------------------------------------------------------------
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;


-- ----------------------------------------------------------------------------
-- 3A. RLS Policies Inventory & Predicates
-- ----------------------------------------------------------------------------
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- ----------------------------------------------------------------------------
-- 3B. Public Functions, Volatility, Security Definer & Configurations
-- ----------------------------------------------------------------------------
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
    END AS volatility,
    p.prosecdef AS is_security_definer,
    p.proleakproof AS is_leakproof,
    p.proconfig AS search_path_config,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;


-- ----------------------------------------------------------------------------
-- 4. Database Triggers Inventory (Timing, Function, Level)
-- ----------------------------------------------------------------------------
SELECT
    event_object_schema AS table_schema,
    event_object_table AS table_name,
    trigger_name,
    action_timing AS timing,
    event_manipulation AS event,
    action_orientation AS level_per_row_or_statement,
    action_statement AS trigger_action
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;


-- ----------------------------------------------------------------------------
-- 5A. Installed PostgreSQL Extensions
-- ----------------------------------------------------------------------------
SELECT
    name,
    default_version,
    installed_version,
    comment
FROM pg_available_extensions
WHERE installed_version IS NOT NULL
ORDER BY name;


-- ----------------------------------------------------------------------------
-- 5B. Top 20 Queries by Total Time & Mean Time (pg_stat_statements if enabled)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        -- Query can be executed directly in SQL editor:
        -- SELECT query, calls, total_exec_time, mean_exec_time, rows FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
        RAISE NOTICE 'pg_stat_statements is INSTALLED. Run the query below:';
    ELSE
        RAISE NOTICE 'pg_stat_statements is NOT enabled. Enable with: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;';
    END IF;
END $$;

-- If pg_stat_statements is enabled, run this:
SELECT
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_exec_time_ms,
    ROUND(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
    ROUND((100.0 * total_exec_time / NULLIF(SUM(total_exec_time) OVER (), 0))::numeric, 2) AS pct_total_time,
    rows,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;


-- ----------------------------------------------------------------------------
-- 6. Max Connections Setting and Connection Counts by State
-- ----------------------------------------------------------------------------
SELECT name, setting, unit, context, short_desc
FROM pg_settings
WHERE name IN ('max_connections', 'shared_buffers', 'work_mem', 'maintenance_work_mem', 'statement_timeout');

SELECT
    state,
    count(*) AS connection_count,
    ROUND(count(*) * 100.0 / (SELECT setting::numeric FROM pg_settings WHERE name = 'max_connections'), 2) AS pct_of_max
FROM pg_stat_activity
GROUP BY state;
