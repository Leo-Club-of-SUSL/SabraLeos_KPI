// supabase/functions/admin-delete-user/index.ts
// Edge Function: Permanently delete a user from auth.users + app_users.
// Supports deletion by user_id, member_reg_no, or bulk cleanup of orphaned accounts.
// Requires: caller JWT with active super_admin or editor role.
// Editors may only delete member accounts (cannot delete officers or super_admins).
// Refuses to delete the caller's own account or the last super_admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Missing authorization header', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerAuth }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerAuth) return errorResponse('Unauthorized', 401);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: profileError } = await serviceClient
      .from('app_users')
      .select('id, role, status')
      .eq('id', callerAuth.id)
      .single();

    if (
      profileError ||
      !callerProfile ||
      !['super_admin', 'editor'].includes(callerProfile.role) ||
      callerProfile.status !== 'active'
    ) {
      return errorResponse('Forbidden: Active Super Admin or Editor access required', 403);
    }

    // 2. Parse input
    const body = await req.json().catch(() => ({}));
    const { user_id, member_reg_no, cleanup_orphaned } = body;

    // --- Scenario A: Bulk cleanup of orphaned member accounts ---
    if (cleanup_orphaned === true) {
      // Find all member accounts linked to a registration number
      const { data: memberAccounts, error: memError } = await serviceClient
        .from('app_users')
        .select('id, username, role, linked_member_reg_no')
        .eq('role', 'member')
        .not('linked_member_reg_no', 'is', null);

      if (memError) {
        return errorResponse(`Database lookup error: ${memError.message}`, 500);
      }

      let deletedCount = 0;
      for (const account of memberAccounts || []) {
        if (!account.linked_member_reg_no) continue;

        // Check if member exists and is not soft-deleted
        const { data: activeMember } = await serviceClient
          .from('members')
          .select('reg_no, deleted_at')
          .ilike('reg_no', account.linked_member_reg_no)
          .is('deleted_at', null)
          .maybeSingle();

        // If member doesn't exist or is soft-deleted, delete this orphaned account
        if (!activeMember) {
          const { error: delErr } = await serviceClient.auth.admin.deleteUser(account.id);
          if (!delErr) {
            deletedCount++;
          }
        }
      }

      return jsonResponse({ success: true, deleted_count: deletedCount });
    }

    // --- Scenario B: Delete account(s) linked to a specific member registration number ---
    if (member_reg_no && typeof member_reg_no === 'string') {
      const cleanReg = member_reg_no.trim();
      if (!cleanReg) {
        return errorResponse('Invalid member_reg_no', 400);
      }

      // Look up any account linked to this member reg_no (or with username matching reg_no)
      const { data: linkedUsers, error: findError } = await serviceClient
        .from('app_users')
        .select('id, role, username, designation, linked_member_reg_no')
        .or(`linked_member_reg_no.ilike.${cleanReg},username.ilike.${cleanReg}`);

      if (findError) {
        console.error('Error finding linked users:', findError.message);
        return errorResponse('Database error searching for linked accounts', 500);
      }

      if (!linkedUsers || linkedUsers.length === 0) {
        return jsonResponse({ success: true, deleted_count: 0, message: 'No linked account found' });
      }

      let deletedCount = 0;
      for (const targetUser of linkedUsers) {
        // Protect officer accounts: If linked user is super_admin or editor, never delete auth account.
        // Instead, unlink them by clearing linked_member_reg_no so their officer account remains intact.
        if (targetUser.role === 'super_admin' || targetUser.role === 'editor') {
          await serviceClient
            .from('app_users')
            .update({ linked_member_reg_no: null })
            .eq('id', targetUser.id);
          continue;
        }

        // Self-deletion guard (in case caller was linked)
        if (targetUser.id === callerAuth.id) {
          await serviceClient
            .from('app_users')
            .update({ linked_member_reg_no: null })
            .eq('id', targetUser.id);
          continue;
        }

        // Target user is a member portal account (role === 'member' or non-officer)
        // Permanently delete auth.users record (cascades to app_users via ON DELETE CASCADE)
        const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetUser.id);
        if (deleteError) {
          console.error(`Failed to delete user ${targetUser.id}:`, deleteError.message);
        } else {
          deletedCount++;
        }
      }

      return jsonResponse({ success: true, deleted_count: deletedCount });
    }

    // --- Scenario C: Delete a single user by user_id ---
    if (user_id && typeof user_id === 'string') {
      // Self-deletion guard
      if (user_id === callerAuth.id) {
        return errorResponse('Cannot delete your own account', 400);
      }

      // Look up target profile
      const { data: targetProfile, error: targetError } = await serviceClient
        .from('app_users')
        .select('id, role, username')
        .eq('id', user_id)
        .single();

      if (targetError || !targetProfile) {
        return errorResponse('Target user not found', 404);
      }

      // Editors may NOT delete super_admin or other editor accounts
      if (callerProfile.role === 'editor' && ['super_admin', 'editor'].includes(targetProfile.role)) {
        return errorResponse('Forbidden: Editors cannot delete Officer or Super Admin accounts', 403);
      }

      // Last super_admin guard
      if (targetProfile.role === 'super_admin') {
        const { count } = await serviceClient
          .from('app_users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'super_admin');

        if ((count ?? 0) <= 1) {
          return errorResponse('Cannot delete the last super_admin account', 400);
        }
      }

      // Delete auth.users record (cascades to app_users via ON DELETE CASCADE)
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user_id);
      if (deleteError) {
        console.error('Delete error:', deleteError.message);
        return errorResponse('Failed to delete user', 500);
      }

      return jsonResponse({ success: true, deleted_count: 1 });
    }

    return errorResponse('user_id or member_reg_no is required', 400);
  } catch (err) {
    console.error('Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
