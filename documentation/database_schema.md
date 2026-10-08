# Database Schema & Security Models

The centralized database configuration rests on PostgreSQL 15, managed and orchestrated through Supabase.

---

## 1. Relational Tables

### 1.1 `members` Table
The primary registry storing all Leo Club members.

| Column | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `reg_no` | `TEXT` | `PRIMARY KEY` | Normalized university registration number (e.g., `22ABC1234`) |
| `photo_url` | `TEXT` | `NULL` | Public CDN URL in Supabase Storage (`members` bucket) |
| `full_name` | `TEXT` | `NOT NULL` | Full legal name |
| `name_with_initials` | `TEXT` | `NOT NULL` | Formatted display name with initials |
| `my_lci_num` | `TEXT` | `NULL` | Optional Lions Club International Member Number |
| `batch` | `TEXT` | `NOT NULL` | Academic batch (e.g., `2021/2022`) |
| `faculty` | `TEXT` | `NOT NULL` | Academic faculty reference |
| `whatsapp` | `TEXT` | `NOT NULL` | Contact number with international dial code |
| `total_points` | `INTEGER` | `DEFAULT 0` | Auto-calculated sum of all approved contributions |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Record registration timestamp |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Timestamp of latest modification |

### 1.2 `contributions` Table
Links project participations, leadership positions, and awarded service points to members.

| Column | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique contribution identifier |
| `member_reg_no` | `TEXT` | `NOT NULL REFERENCES members(reg_no) ON DELETE CASCADE` | Member receiving points |
| `project_name` | `TEXT` | `NOT NULL` | Project or activity title |
| `time_period` | `TEXT` | `NOT NULL` | Format `YYYY-MM` (used for monthly rankings) |
| `position` | `TEXT` | `NOT NULL` | Role held (e.g., "Chair", "Team Lead", "Volunteer") |
| `points` | `INTEGER` | `NOT NULL CHECK (points BETWEEN 1 AND 1000)` | Points awarded |
| `avenue` | `TEXT` | `NULL` | Leo Club service avenue |
| `date_added` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Date contribution was recorded |
| `added_by` | `UUID` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Officer who recorded the points |

### 1.3 `app_users` Table
Defines system user identities, authorization roles, and links them to club member records.

| Column | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | References Supabase Auth user ID |
| `username` | `TEXT` | `UNIQUE NOT NULL` | Login username / display handle |
| `designation` | `TEXT` | `NOT NULL` | Position in club leadership or club status |
| `role` | `TEXT` | `NOT NULL CHECK (role IN ('super_admin', 'admin', 'editor', 'viewer', 'member'))` | System RBAC authorization role |
| `status` | `TEXT` | `NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'))` | Account status |
| `linked_member_reg_no` | `TEXT` | `REFERENCES members(reg_no) ON DELETE SET NULL` | Link to personal member registry record |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Account creation timestamp |

### 1.4 Taxonomy Tables: `faculties`, `batches`, `avenues`
- **`faculties`**: `id` (UUID PK), `name` (TEXT UNIQUE NOT NULL), `created_at` (TIMESTAMPTZ).
- **`batches`**: `id` (UUID PK), `name` (TEXT UNIQUE NOT NULL), `created_at` (TIMESTAMPTZ).
- **`avenues`**: `id` (UUID PK), `name` (TEXT UNIQUE NOT NULL), `created_at` (TIMESTAMPTZ).

### 1.5 `tier_settings` Table
Dynamic point threshold configuration for club recognition tiers.

| Column | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Tier slug (`bronze`, `silver`, `gold`, `platinum`, `diamond`) |
| `name` | `TEXT` | `NOT NULL` | Human-readable label (e.g., "Gold") |
| `min_points` | `INTEGER` | `NOT NULL DEFAULT 0` | Threshold points required to attain tier |
| `color` | `TEXT` | `NOT NULL` | Brand color code |
| `badge_style` | `TEXT` | `NOT NULL` | CSS style token |
| `sort_order` | `INTEGER` | `NOT NULL DEFAULT 0` | Display ordering sequence |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Last adjustment timestamp |

### 1.6 Audit & Security Tables

#### `system_logs`
Tracks data and entity mutations across the system.
- `id` (UUID PK DEFAULT gen_random_uuid())
- `created_at` / `timestamp` (TIMESTAMPTZ DEFAULT NOW())
- `user_id` (UUID REFERENCES auth.users(id) ON DELETE SET NULL)
- `actor_name` (TEXT) - Resolved display name or username
- `user_name` (TEXT) - Fallback actor handle
- `action` (TEXT NOT NULL) - e.g., `CREATE_MEMBER`, `UPDATE_MEMBER`, `DELETE_MEMBER`, `CREATE_CONTRIBUTION`, `BULK_CREATE_CONTRIBUTIONS`, `EXPORT_REPORT`
- `entity_type` (TEXT) - `member`, `contribution`, `user`, `system_data`, `tier_settings`
- `entity_id` (TEXT) - Target primary key or identifier
- `details` (JSONB) - Event payload, diff, or query metadata

#### `security_events`
Tracks authentication and security occurrences.
- `id` (UUID PK DEFAULT gen_random_uuid())
- `created_at` (TIMESTAMPTZ DEFAULT NOW())
- `event_type` (TEXT NOT NULL) - `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_RESET`, `LOCKOUT`
- `severity` (TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'CRITICAL')))
- `actor_id` (UUID REFERENCES auth.users(id) ON DELETE SET NULL)
- `actor_email` (TEXT) - Associated email address
- `actor_name` (TEXT) - Resolved human name
- `details` (JSONB) - Client IP, user agent, or lockout parameters

---

## 2. Stored Procedures & High-Performance RPCs

### 2.1 Session Context RPC (`get_my_session_context`)
Reduces application startup overhead from 3-4 waterfall requests down to a single PostgreSQL roundtrip:
```sql
CREATE OR REPLACE FUNCTION public.get_my_session_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user public.app_users%ROWTYPE;
  v_member public.members%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT * INTO v_user FROM public.app_users WHERE id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('authenticated', true, 'profile_found', false);
  END IF;

  IF v_user.linked_member_reg_no IS NOT NULL THEN
    SELECT * INTO v_member FROM public.members WHERE reg_no = v_user.linked_member_reg_no;
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'profile_found', true,
    'app_user', to_jsonb(v_user),
    'member', CASE WHEN v_member.reg_no IS NOT NULL THEN to_jsonb(v_member) ELSE NULL END
  );
END;
$$;
```

### 2.2 Dashboard Stats RPC (`get_dashboard_stats`)
Aggregates member counts, total points, monthly project volume, and avenue distributions on the database server, returning a compact JSON payload to the client.

### 2.3 Automatic Point Recalculation Trigger
Runs `AFTER INSERT OR UPDATE OR DELETE ON public.contributions`:
```sql
CREATE OR REPLACE FUNCTION public.recalculate_member_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE target_reg_no TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN 
    target_reg_no := OLD.member_reg_no;
  ELSE 
    target_reg_no := NEW.member_reg_no; 
  END IF;

  UPDATE public.members
  SET total_points = COALESCE((SELECT SUM(points) FROM public.contributions WHERE member_reg_no = target_reg_no), 0),
      updated_at = NOW()
  WHERE reg_no = target_reg_no;

  RETURN COALESCE(NEW, OLD);
END;
$$;
```

---

## 3. Performance Indexes Architecture

To prevent full-table sequential scans during large queries, the database implements B-tree indexes:

```sql
-- Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_contributions_member_reg_no ON public.contributions (member_reg_no);
CREATE INDEX IF NOT EXISTS idx_contributions_added_by ON public.contributions (added_by);
CREATE INDEX IF NOT EXISTS idx_app_users_linked_member ON public.app_users (linked_member_reg_no);

-- Filter & Ranking Indexes
CREATE INDEX IF NOT EXISTS idx_contributions_time_period ON public.contributions (time_period);
CREATE INDEX IF NOT EXISTS idx_contributions_date_added ON public.contributions (date_added DESC);
CREATE INDEX IF NOT EXISTS idx_members_total_points ON public.members (total_points DESC);
CREATE INDEX IF NOT EXISTS idx_members_faculty ON public.members (faculty);
CREATE INDEX IF NOT EXISTS idx_members_batch ON public.members (batch);

-- Audit Logging Indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events (created_at DESC);
```

---

## 4. Row Level Security (RLS) Policy Architecture

All tables operate in **fail-closed** mode (`DEFAULT DENY`). Access policies wrap authorization helper functions in subqueries (e.g. `(SELECT is_officer())`), which instructs the PostgreSQL query planner to cache the security check per query instead of evaluating it row-by-row.

### Helper Authorization Functions
- `is_super_admin()`: Returns `TRUE` if `role = 'super_admin'`.
- `is_admin_or_super()`: Returns `TRUE` if `role IN ('super_admin', 'admin')`.
- `is_officer()`: Returns `TRUE` if `role IN ('super_admin', 'admin', 'editor')`.
- `is_member()`: Returns `TRUE` if caller has any valid `app_users` profile.

### Policy Enforcement Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
| :--- | :--- | :--- | :--- | :--- |
| **`members`** | Authenticated (`is_member()`) | `is_officer()` | `is_officer()` | `is_admin_or_super()` |
| **`contributions`** | Authenticated (`is_member()`) | `is_officer()` | `is_admin_or_super()` OR (`is_officer()` AND `added_by = (SELECT auth.uid())`) | `is_admin_or_super()` |
| **`app_users`** | Authenticated (`is_member()`) | Service Role Only | `is_admin_or_super()` OR `id = (SELECT auth.uid())` | Service Role Only |
| **`tier_settings`** | Authenticated (`is_member()`) | `is_super_admin()` | `is_super_admin()` | `is_super_admin()` |
| **`system_logs`** | `is_officer()` | Authenticated (Any) | Denied | Denied |
| **`security_events`**| `is_officer()` | Authenticated (Any) | Denied | Denied |
| **`storage.objects` (`members`)** | Public (`bucket_id = 'members'`) | `is_officer()` | `is_officer()` | `is_admin_or_super()` |

