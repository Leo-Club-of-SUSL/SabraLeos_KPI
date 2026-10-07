// supabase/functions/admin-create-user/index.ts
// Invite-only officer creation (viewer, editor, super_admin) — super_admin only

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
    const { email, username, designation, role, linked_member_reg_no } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return errorResponse('Valid email is required', 400, corsHeaders);
    }
    if (!username || typeof username !== 'string' || username.length < 2 || username.length > 50) {
      return errorResponse('Username must be 2-50 characters', 400, corsHeaders);
    }
    if (!designation || typeof designation !== 'string' || designation.length < 2 || designation.length > 100) {
      return errorResponse('Designation must be 2-100 characters', 400, corsHeaders);
    }
    const validRoles = ['super_admin', 'editor', 'viewer', 'member'];
    if (!role || !validRoles.includes(role)) {
      return errorResponse('Invalid role', 400, corsHeaders);
    }

    const redirectUrl = origin.includes('#') 
      ? `${origin}/auth/set-password` 
      : `${origin}/#auth/set-password`;

    // 3. Send invite email — password must NEVER be chosen or set by admin
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
        intended_role: role,
        created_by_admin: true,
      },
    });

    if (inviteError || !inviteData?.user) {
      console.error('Invite error:', inviteError?.message);
      return errorResponse(inviteError?.message || 'Failed to send invite email', 400, corsHeaders);
    }

    const newUserId = inviteData.user.id;

    // 4. Create app_users profile
    const { data: profileData, error: insertError } = await serviceClient
      .from('app_users')
      .insert({
        id: newUserId,
        username,
        designation,
        role,
        linked_member_reg_no: linked_member_reg_no || null,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      // Compensating rollback
      await serviceClient.auth.admin.deleteUser(newUserId);
      console.error('Profile insert error:', insertError.message);
      return errorResponse(`Failed to create user profile: ${insertError.message}`, 500, corsHeaders);
    }

    return new Response(JSON.stringify({ success: true, user: profileData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});

function errorResponse(message: string, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
    status,
  });
}
