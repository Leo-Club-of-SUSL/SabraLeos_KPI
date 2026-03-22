# Database Schema & Security Models

The centralized database configuration rests on PostgreSQL, orchestrated by Supabase.

## 1. Relational Tables

### 1.1 `members` Table
Stores all the primary registry information about each Leo Club member.

- `reg_no` (Primary Key, VARCHAR/TEXT): The official club registration number. (e.g., LEO-2023-001)
- `first_name` (VARCHAR/TEXT): Given Name.
- `last_name` (VARCHAR/TEXT): Family Name.
- `faculty` (VARCHAR/TEXT): University Faculty (e.g., Computing, Science).
- `photo_url` (VARCHAR/TEXT): Nullable URI pointing to Supabase Storage.
- `total_points` (INTEGER): An auto-calculated metric triggered by rows in `contributions`.
- `created_at` (TIMESTAMP): Date registered.
- `updated_at` (TIMESTAMP): Date of last structural modification.

### 1.2 `contributions` Table
Links specific points and event assignments to members.

- `id` (Primary Key, UUID): A globally unique identifier.
- `member_reg_no` (Foreign Key, VARCHAR): References `members(reg_no)`
- `project_name` (VARCHAR/TEXT): The project or event context.
- `avenue` (VARCHAR/TEXT): The specific Leo Service Avenue (e.g., Health, Education, Environment).
- `points` (INTEGER): Granted points for the contribution.
- `added_by` (Foreign Key, UUID): The `auth.users` ID who recorded the item.
- `created_at` (TIMESTAMP): Date contributed.

### 1.3 `app_users` Table
Defines internal application user permissions and ties standard Auth users to internal registry profiles.

- `id` (Primary Key, UUID): Links 1-to-1 with `auth.users` table ID.
- `username` (VARCHAR): User's login handle.
- `designation` (VARCHAR): Official club designation (e.g., Secretary, President, Member).
- `role` (ENUM: `super_admin`, `editor`, `viewer`): Defines operational permissions in the frontend and at the RLS database level.
- `linked_member_reg_no` (Foreign Key, VARCHAR): Crucial element linking this software user to the physical club member record in `members`. Allows an active tracker to see "their own points" seamlessly.
- `created_at` (TIMESTAMP)

## 2. Row Level Security (RLS)

All tables employ **Row Level Security** to explicitly restrict access to authenticated queries based on their active identity payload. Let's detail the RLS configuration.

### 2.1 Policies

* **Read Access:** Generally unrestricted to authenticated users. All `app_users` with `role IN ('super_admin', 'editor', 'viewer')` can SELEСT rows from `members`, `contributions`, and `app_users`.
* **Insert/Update/Delete:** Mutating tables usually require the user to have a specific role:
  - `super_admin` can unconditionally modify everything.
  - `editor` can `INSERT`, `UPDATE`, `DELETE` rows in `members` and `contributions`. But cannot modify `app_users`.
  - `viewer` possesses no `INSERT`, `UPDATE`, or `DELETE` abilities.
* **RLS Definitions:** Policy statements securely check `app_users.role` derived directly from `auth.uid()`.

## 3. Database Triggers

### 3.1 Point Recalculation
Instead of requiring the client App to meticulously manage user points, the Database implements an automatic reconciliation flow via Triggers.
Any change across `contributions` (`INSERT`, `UPDATE`, or `DELETE`) executes a Point Recalculation function:
1. `AFTER INSERT, UPDATE, DELETE ON contributions`
2. Invokes a function to `SUM(points)` where `member_reg_no = NEW.member_reg_no`
3. Updates `members.total_points` inline.

### 3.2 Constraints
- The `app_users.id` foreign key constraint enforces `ON DELETE CASCADE` from `auth.users`.
- `contributions.member_reg_no` uses an `ON DELETE CASCADE` rule so that when a Member is purged, all related contributions are likewise scrubbed.
