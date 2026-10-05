// supabase/functions/admin-send-password-reset/index.ts
// Super Admin initiates password reset for another user (sends email to their inbox only)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://nexus-kpi.pages.dev',
  'https://kpi.sapraleos.org',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.pages.dev');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify caller is super_admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerAuth }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerAuth) {
      return errorResponse('Unauthorized', 401, corsHeaders);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: profileError } = await serviceClient
      .from('app_users')
      .select('role, status')
      .eq('id', callerAuth.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== 'super_admin' || callerProfile.status !== 'active') {
      return errorResponse('Forbidden: super_admin role required', 403, corsHeaders);
    }

    // 2. Validate input
    const body = await req.json();
    const { user_id } = body;

    if (!user_id || typeof user_id !== 'string') {
      return errorResponse('user_id is required', 400, corsHeaders);
    }

    // Look up target auth user
    const { data: targetUser, error: userError } = await serviceClient.auth.admin.getUserById(user_id);
    if (userError || !targetUser?.user?.email) {
      return errorResponse('Target user not found or has no email', 404, corsHeaders);
    }

    const origin = req.headers.get('Origin') || 'https://nexus-kpi.pages.dev';

    // 3. Send reset email via Supabase Auth
    const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(
      targetUser.user.email,
      {
        redirectTo: `${origin}/auth/set-password`,
      }
    );

    if (resetError) {
      console.error('Password reset email error:', resetError.message);
      return errorResponse('Failed to send password reset email', 500, corsHeaders);
    }

    // 4. Log security event in DB
    await serviceClient.rpc('log_security_event', {
      p_event_type: 'ADMIN_RESET_PASSWORD_TRIGGERED',
      p_target_user_id: user_id,
      p_details: { target_email: targetUser.user.email },
    });

    return new Response(JSON.stringify({ success: true, message: 'Password reset email sent to user' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Admin password reset error:', err);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});

function errorResponse(message: string, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
    status,
  });
}
