# Disable Email Confirmation for New Users

## Problem
When creating new users through the admin panel, they cannot log in because Supabase requires email confirmation by default.

## Solution
Disable email confirmation in your Supabase project settings:

### Steps:

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard

2. **Select your project**

3. **Go to Authentication Settings**
   - Click on "Authentication" in the left sidebar
   - Click on "Providers" 
   - Scroll down to "Email" provider

4. **Disable Email Confirmation**
   - Find the setting "Enable email confirmations"
   - **Turn it OFF** (toggle to disabled)
   - Click "Save"

### Alternative: Auto-confirm users (Recommended for Admin-Created Users)

If you want to keep email confirmation for self-registered users but auto-confirm admin-created users, you would need to:

1. Use a Supabase Edge Function with the service role key
2. Call `supabase.auth.admin.createUser()` with `email_confirm: true`

This requires server-side code and is more secure for production.

## Quick Fix (Development Only)

For development/testing, simply disable email confirmation as described above. All newly created users will be able to log in immediately.

## After Disabling Email Confirmation

1. Any users created **after** this change will be able to log in immediately
2. Users created **before** this change may still need email confirmation
3. To manually confirm existing users:
   - Go to Authentication → Users in Supabase Dashboard
   - Click on the user
   - Click "Confirm Email"
