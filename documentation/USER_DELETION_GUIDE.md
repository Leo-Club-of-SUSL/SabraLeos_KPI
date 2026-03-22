# User Deletion Guide

## ⚠️ Important: Two-Step User Deletion

When you delete a user in the User Management interface, it only deletes the **user profile** from the `app_users` table. The user still exists in **Supabase Authentication** (`auth.users`).

### Why This Happens

- Deleting from `auth.users` requires **service role key** (admin privileges)
- Service role keys cannot be exposed in client-side code for security
- This is a limitation of client-side user management

---

## 🔧 How to Fully Delete a User

### Method 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication**
   - Click "Authentication" in the left sidebar
   - Click "Users"

3. **Find and Delete the User**
   - Find the user by email
   - Click the three dots (⋮) next to the user
   - Click "Delete user"
   - Confirm deletion

### Method 2: SQL Query (Advanced)

If you need to delete multiple users, you can run this SQL in the Supabase SQL Editor:

```sql
-- Delete from auth.users (requires service role)
DELETE FROM auth.users WHERE email = 'user@example.com';
```

**Note:** This will automatically cascade delete the profile in `app_users` if you have proper foreign key constraints.

---

## 🐛 Troubleshooting: "User Already Exists" Error

### Problem
You deleted a user from the User Management interface and tried to create a new user with the same email, but got "User already exists" error.

### Why This Happens
The auth user still exists in Supabase Auth even though the profile was deleted.

### Solution

**Option A: Delete the Auth User First**
1. Go to Supabase Dashboard → Authentication → Users
2. Delete the user with that email
3. Now you can create a new user with the same email

**Option B: Use a Different Email**
- Create the new user with a different email address

**Option C: Manually Confirm the Existing User**
If the user exists but can't log in:
1. Go to Supabase Dashboard → Authentication → Users
2. Find the user
3. Click "Confirm Email"
4. Try logging in with the original password

---

## 🔐 Current Super Admin Login Issue - SOLUTION

### Your Specific Problem
1. You deleted a super admin from the UI
2. The profile was deleted but auth user remained
3. You tried to create a "new" super admin with the same email
4. Supabase said "user already exists" but used the OLD password
5. You can't log in because you don't know the old password

### Fix Steps

1. **Go to Supabase Dashboard**
   - Authentication → Users
   - Find the super admin user by email

2. **Option A: Delete and Recreate**
   - Delete the user completely
   - Go back to your app
   - Create a new super admin with the same email
   - Use the new password you set

3. **Option B: Reset Password**
   - Click on the user
   - Click "Send Password Reset Email"
   - Check the email and reset the password
   - Log in with the new password

4. **Option C: Manually Set Password (Advanced)**
   - In Supabase Dashboard, click on the user
   - Look for password reset options
   - Set a new password manually

---

## 🚀 Production Solution: Edge Function

For a production app, implement a Supabase Edge Function to handle user deletion:

```typescript
// supabase/functions/delete-user/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { userId } = await req.json()
  
  // Create admin client with service role key
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  // Delete from auth.users (will cascade to app_users)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  
  return new Response(
    JSON.stringify({ success: !error, error }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

Then call this from your client-side code instead of the current delete method.

---

## 📝 Summary

- **Current Setup**: Deletes profile only, auth user remains
- **Immediate Fix**: Manually delete auth users from Supabase Dashboard
- **Production Fix**: Implement Edge Function with service role key
- **Best Practice**: Always delete from Supabase Dashboard for now

---

## ✅ Quick Checklist After Deleting a User

- [ ] User deleted from User Management interface
- [ ] Go to Supabase Dashboard → Authentication → Users
- [ ] Find and delete the auth user
- [ ] Verify user is completely removed
- [ ] Can now create new user with same email if needed
