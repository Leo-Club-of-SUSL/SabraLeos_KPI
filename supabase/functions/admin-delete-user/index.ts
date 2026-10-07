// supabase/functions/admin-delete-user/index.ts
// Edge Function: Permanently delete a user from auth.users + app_users.
// Requires: caller JWT with super_admin role.
// Refuses to delete the last super_admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerAuth }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerAuth) return errorResponse('Unauthorized', 401);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await serviceClient
      .from('app_users')
      .select('role, status')
      .eq('id', callerAuth.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'super_admin' || callerProfile.status !== 'active') {
      return errorResponse('Forbidden: super_admin role required', 403);
    }

    // Validate input
    const body = await req.json();
    const { user_id } = body;
    if (!user_id || typeof user_id !== 'string') {
      return errorResponse('Invalid user_id', 400);
    }

    // Self-deletion guard
    if (user_id === callerAuth.id) {
      return errorResponse('Cannot delete your own account', 400);
    }

    // Last super_admin guard
    const { data: targetProfile } = await serviceClient
      .from('app_users')
      .select('role, username')
      .eq('id', user_id)
      .single();

    if (targetProfile?.role === 'super_admin') {
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
