# SabraLeos Database Setup Guide

This guide will help you set up the Supabase database for the SabraLeos application.

## Prerequisites

- Access to your Supabase project dashboard
- SQL Editor access in Supabase

## Setup Instructions

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard at https://app.supabase.com
2. Navigate to the SQL Editor (left sidebar)
3. Click on "New Query"

### Step 2: Run the Migration Script

Copy and paste the following SQL script and execute it:

```sql
-- Create members table
CREATE TABLE IF NOT EXISTS members (
  reg_no text PRIMARY KEY,
  photo_url text,
  full_name text NOT NULL,
  name_with_initials text NOT NULL,
  my_lci_num text,
  batch text NOT NULL,
  faculty text NOT NULL,
  whatsapp text NOT NULL,
  total_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create contributions table
CREATE TABLE IF NOT EXISTS contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_reg_no text NOT NULL REFERENCES members(reg_no) ON DELETE CASCADE,
  project_name text NOT NULL,
  time_period text NOT NULL,
  position text NOT NULL,
  points integer NOT NULL,
  avenue text,
  date_added timestamptz DEFAULT now(),
  added_by uuid REFERENCES auth.users(id)
);

-- Create app_users table
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  designation text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'editor', 'viewer')),
  linked_member_reg_no text REFERENCES members(reg_no),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contributions_member ON contributions(member_reg_no);
CREATE INDEX IF NOT EXISTS idx_contributions_date ON contributions(date_added);
CREATE INDEX IF NOT EXISTS idx_members_points ON members(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_members_faculty ON members(faculty);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- Enable Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for members
CREATE POLICY "Authenticated users can view all members"
  ON members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors and admins can insert members"
  ON members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role IN ('super_admin', 'editor')
    )
  );

CREATE POLICY "Editors and admins can update members"
  ON members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role IN ('super_admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role IN ('super_admin', 'editor')
    )
  );

-- RLS Policies for contributions
CREATE POLICY "Authenticated users can view all contributions"
  ON contributions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors and admins can insert contributions"
  ON contributions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role IN ('super_admin', 'editor')
    )
  );

CREATE POLICY "Editors and admins can update contributions"
  ON contributions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role IN ('super_admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role IN ('super_admin', 'editor')
    )
  );

CREATE POLICY "Editors and admins can delete contributions"
  ON contributions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role IN ('super_admin', 'editor')
    )
  );

-- RLS Policies for app_users
CREATE POLICY "Users can view their own profile"
  ON app_users FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM app_users
    WHERE app_users.id = auth.uid()
    AND app_users.role = 'super_admin'
  ));

CREATE POLICY "Super admins can insert users"
  ON app_users FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update users"
  ON app_users FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'super_admin'
    )
  );

-- Auto-update member points trigger function
CREATE OR REPLACE FUNCTION update_member_points()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE members
    SET total_points = COALESCE((
      SELECT SUM(points) FROM contributions
      WHERE member_reg_no = OLD.member_reg_no
    ), 0),
    updated_at = now()
    WHERE reg_no = OLD.member_reg_no;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE members
    SET total_points = COALESCE((
      SELECT SUM(points) FROM contributions
      WHERE member_reg_no = NEW.member_reg_no
    ), 0),
    updated_at = now()
    WHERE reg_no = NEW.member_reg_no;

    IF (OLD.member_reg_no != NEW.member_reg_no) THEN
      UPDATE members
      SET total_points = COALESCE((
        SELECT SUM(points) FROM contributions
        WHERE member_reg_no = OLD.member_reg_no
      ), 0),
      updated_at = now()
      WHERE reg_no = OLD.member_reg_no;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    UPDATE members
    SET total_points = COALESCE((
      SELECT SUM(points) FROM contributions
      WHERE member_reg_no = NEW.member_reg_no
    ), 0),
    updated_at = now()
    WHERE reg_no = NEW.member_reg_no;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_member_points ON contributions;
CREATE TRIGGER trigger_update_member_points
  AFTER INSERT OR UPDATE OR DELETE ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_member_points();

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_members_updated_at ON members;
CREATE TRIGGER trigger_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Step 3: Create Your First Admin User

After running the migration, you need to create your first admin user manually:

1. Go to Authentication > Users in Supabase Dashboard
2. Click "Add User" and create a user with email and password
3. Copy the User ID
4. Go back to SQL Editor and run:

```sql
INSERT INTO app_users (id, username, designation, role)
VALUES ('YOUR_USER_ID_HERE', 'admin', 'System Administrator', 'super_admin');
```

Replace `YOUR_USER_ID_HERE` with the actual User ID you copied.

### Step 4: Test Your Setup

1. Return to the SabraLeos application
2. Log in with the email and password you created
3. You should now have full access as a Super Admin

## User Roles

- **Super Admin**: Can create users, manage all members and contributions
- **Editor**: Can add members and contributions (Directors)
- **Viewer**: Read-only access to all data

## Next Steps

Once logged in as Super Admin, you can:

1. Create additional users through the User Management page
2. Link user accounts to member records using University Reg No
3. Add members through the Members page
4. Start tracking contributions

## Troubleshooting

If you encounter any issues:

1. Check that all tables were created successfully in Supabase Table Editor
2. Verify RLS is enabled on all tables
3. Ensure your first admin user was created in both auth.users and app_users tables
4. Check the browser console for any error messages
