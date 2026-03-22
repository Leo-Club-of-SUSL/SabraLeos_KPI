# SabraLeos - Quick Start Guide

Get up and running with SabraLeos in 5 minutes!

## Step 1: Database Setup (2 minutes)

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy the SQL script from `DATABASE_SETUP.md`
4. Paste and execute the script
5. Create your first admin user following the guide

## Step 2: Create Your First Admin (1 minute)

In Supabase Dashboard:

1. Go to Authentication → Users
2. Click "Add User"
3. Create user with email: `admin@example.com`, password: `nexus123`
4. Copy the User ID
5. In SQL Editor, run:

```sql
INSERT INTO app_users (id, username, designation, role)
VALUES ('YOUR_COPIED_USER_ID', 'admin', 'System Administrator', 'super_admin');
```

## Step 3: Log In (30 seconds)

1. Open the SabraLeos app
2. Log in with:
   - Email: `admin@example.com`
   - Password: `nexus123`

## Step 4: Add Your First Member (1 minute)

1. Click "Members" in the navbar
2. Search for any Reg No (e.g., "S/2021/001")
3. Click "Register New Member"
4. Fill in the form:
   - Reg No: S/2021/001
   - Full Name: Saman Kumara Perera
   - Name with Initials: S.K. Perera
   - Batch: 2021
   - Faculty: Engineering
   - WhatsApp: +94771234567
5. Click "Create Member"

## Step 5: Add a Contribution (30 seconds)

1. On the member's profile, click "Add Contribution"
2. Fill in:
   - Project Name: Blood Donation Campaign
   - Time Period: November 2024
   - Position: Coordinator
   - Points: 10
3. Click "Add Contribution"

## Done!

You're now ready to use SabraLeos! Here's what you can do next:

### Immediate Next Steps

- **Create More Users**: User Management → Create User
- **Link Users to Members**: When creating users, select their member record
- **Add More Members**: Use the Members page
- **View Reports**: Check the Reports page for filtering and export

### Tips for Success

1. **Link Board Members**: Always link user accounts to their member records so they accumulate points
2. **Use Search**: Quick member lookup on Dashboard
3. **Export Data**: Use Reports page to export filtered data to CSV
4. **Enable Dark Mode**: Toggle in navbar for comfortable viewing
5. **Install as App**: Add to home screen for PWA experience

### Common Workflows

**Adding Points Quickly**:
Dashboard → Search member → Add Contribution

**Creating New Board Members**:
User Management → Create User → Link to member → Send credentials

**Generating Reports**:
Reports → Apply filters → Export to CSV

**Checking Leaderboard**:
Dashboard → View Top Contributors

## Need Help?

- Check `README.md` for full documentation
- Review `DATABASE_SETUP.md` for database issues
- Check browser console for error messages
- Verify Supabase project is running

## Default Test Data

The app will seed some test members on first load:

1. S/2021/001 - Saman Kumara Perera (Engineering)
2. S/2021/002 - Nimal Rajapakse Silva (Science)
3. S/2022/001 - Kamal Wickramasinghe Fernando (Management)

Feel free to use these for testing or delete them later.

## Important Reminders

- Always link user accounts to member records
- Points auto-calculate when contributions are added
- Export reports regularly for backup
- Super Admin can create users
- Editors can add members and contributions
- Viewers have read-only access

## Security Note

**Change the default admin password immediately!**

After first login:
1. Go to your Supabase Authentication dashboard
2. Find your admin user
3. Reset the password to something secure

Happy tracking!
