// supabase/functions/admin-set-user-password/index.ts
// Direct password setting for existing user accounts (Admin/Editor) — no email sending required

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
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify caller is super_admin or editor
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerAuth }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerAuth) {
      return errorResponse('Unauthorized', 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: profileError } = await serviceClient
      .from('app_users')
      .select('role, status')
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

    // 2. Validate input
    const body = await req.json();
    const { user_id, new_password } = body;

    if (!user_id || typeof user_id !== 'string') {
      return errorResponse('user_id is required', 400);
    }
    if (!new_password || typeof new_password !== 'string' || new_password.trim().length < 6) {
      return errorResponse('new_password must be at least 6 characters long', 400);
    }

    // Look up target profile
    const { data: targetProfile, error: targetError } = await serviceClient
      .from('app_users')
      .select('id, role, username')
      .eq('id', user_id)
      .single();

    if (targetError || !targetProfile) {
      return errorResponse('Target user profile not found', 404);
    }

    // Editor cannot reset super_admin's password
    if (callerProfile.role === 'editor' && targetProfile.role === 'super_admin') {
      return errorResponse('Forbidden: Editors cannot reset Super Admin passwords', 403);
    }

    // 3. Update password via Supabase Auth Admin
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(user_id, {
      password: new_password.trim(),
    });

    if (updateError) {
      console.error('Password update error:', updateError.message);
      return errorResponse(`Failed to update password: ${updateError.message}`, 500);
    }

    // 4. Log security event
    try {
      await serviceClient.rpc('log_security_event', {
        p_event_type: 'ADMIN_SET_PASSWORD_DIRECT',
        p_target_user_id: user_id,
        p_details: {
          updated_by: callerAuth.id,
          target_username: targetProfile.username,
        },
      });
    } catch {
      // Non-fatal
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password successfully updated for user',
        temporaryPassword: new_password.trim(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    console.error('Admin set password error:', err);
    return errorResponse('Internal server error', 500);
  }
});

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
