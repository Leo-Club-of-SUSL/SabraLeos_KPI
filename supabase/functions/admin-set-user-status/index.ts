// supabase/functions/admin-set-user-status/index.ts
// Edge Function: Suspend or reactivate a user account.
// Suspend: bans in Supabase Auth + sets app_users.status = 'suspended'.
// Reactivate: removes ban + sets app_users.status = 'active'.
// Requires: caller JWT with super_admin role.

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
    const { user_id, action } = body; // action: 'suspend' | 'reactivate'

    if (!user_id || typeof user_id !== 'string') {
      return errorResponse('Invalid user_id', 400);
    }
    if (action !== 'suspend' && action !== 'reactivate') {
      return errorResponse('action must be "suspend" or "reactivate"', 400);
    }
    if (user_id === callerAuth.id) {
      return errorResponse('Cannot change your own account status', 400);
    }

    // Last super_admin guard for suspension
    if (action === 'suspend') {
      const { data: targetProfile } = await serviceClient
        .from('app_users')
        .select('role')
        .eq('id', user_id)
        .single();

      if (targetProfile?.role === 'super_admin') {
        const { count } = await serviceClient
          .from('app_users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'super_admin')
          .eq('status', 'active');

        if ((count ?? 0) <= 1) {
          return errorResponse('Cannot suspend the last active super_admin account', 400);
        }
      }
    }

    // Update Auth ban status
    const { error: authError } = await serviceClient.auth.admin.updateUserById(user_id, {
      ban_duration: action === 'suspend' ? '876600h' : 'none', // 100 years vs remove ban
    });

    if (authError) {
      console.error('Auth update error:', authError.message);
      return errorResponse('Failed to update auth status', 500);
    }

    // Update app_users.status
    const { error: dbError } = await serviceClient
      .from('app_users')
      .update({ status: action === 'suspend' ? 'suspended' : 'active' })
      .eq('id', user_id);

    if (dbError) {
      console.error('DB update error:', dbError.message);
      return errorResponse('Failed to update user status', 500);
    }

    return new Response(JSON.stringify({ success: true, status: action === 'suspend' ? 'suspended' : 'active' }), {
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
