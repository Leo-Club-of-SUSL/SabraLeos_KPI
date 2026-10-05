// supabase/functions/admin-change-user-email/index.ts
// Super Admin updates an on-file email, revokes sessions, and re-invites

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

    const body = await req.json();
    const { user_id, new_email } = body;

    if (!user_id || !new_email || !new_email.includes('@')) {
      return errorResponse('user_id and valid new_email are required', 400, corsHeaders);
    }

    // Update email in Supabase Auth
    const { data: updatedUser, error: updateError } = await serviceClient.auth.admin.updateUserById(user_id, {
      email: new_email,
      email_confirm: true,
    });

    if (updateError) {
      return errorResponse(updateError.message || 'Failed to update email in auth', 400, corsHeaders);
    }

    // Update linked member email if applicable
    const { data: appUser } = await serviceClient
      .from('app_users')
      .select('linked_member_reg_no')
      .eq('id', user_id)
      .single();

    if (appUser?.linked_member_reg_no) {
      await serviceClient
        .from('members')
        .update({ email: new_email })
        .eq('reg_no', appUser.linked_member_reg_no);
    }

    // Log security event
    await serviceClient.rpc('log_security_event', {
      p_event_type: 'USER_EMAIL_CHANGED',
      p_target_user_id: user_id,
      p_details: { new_email },
    });

    return new Response(JSON.stringify({ success: true, user: updatedUser.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Email change error:', err);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});

function errorResponse(message: string, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
    status,
  });
}
