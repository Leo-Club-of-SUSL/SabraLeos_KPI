// supabase/functions/admin-create-user/index.ts
// Direct officer creation with manual mock/temporary credentials — no email sending required

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
    const { email, username, designation, role, linked_member_reg_no, password } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return errorResponse('Valid email is required', 400);
    }
    if (!username || typeof username !== 'string' || username.length < 2 || username.length > 50) {
      return errorResponse('Username must be 2-50 characters', 400);
    }
    if (!designation || typeof designation !== 'string' || designation.length < 2 || designation.length > 100) {
      return errorResponse('Designation must be 2-100 characters', 400);
    }
    const validRoles = ['super_admin', 'editor', 'viewer', 'member'];
    if (!role || !validRoles.includes(role)) {
      return errorResponse('Invalid role', 400);
    }

    // If caller is editor, cannot create super_admin
    if (callerProfile.role === 'editor' && role === 'super_admin') {
      return errorResponse('Forbidden: Editors cannot create Super Admin accounts', 403);
    }

    // Determine password to set
    const userPassword = (typeof password === 'string' && password.trim().length >= 6)
      ? password.trim()
      : `Leo@${username.replace(/[^a-zA-Z0-9]/g, '') || 'Nexus'}2026!`;

    // 3. Create active auth user directly without email confirmation
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        intended_role: role,
        linked_member_reg_no: linked_member_reg_no || null,
        created_by: callerAuth.id,
      },
    });

    if (authError || !authData?.user) {
      console.error('Create user auth error:', authError?.message);
      return errorResponse(authError?.message || 'Failed to create auth user', 400);
    }

    const newUserId = authData.user.id;

    // 4. Create app_users profile
    const { data: profileData, error: insertError } = await serviceClient
      .from('app_users')
      .insert({
        id: newUserId,
        username: username.trim(),
        designation: designation.trim(),
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
      return errorResponse(`Failed to create user profile: ${insertError.message}`, 500);
    }

    // Log security event
    try {
      await serviceClient.rpc('log_security_event', {
        p_event_type: 'USER_CREATED_DIRECT',
        p_target_user_id: newUserId,
        p_details: { email: email.trim().toLowerCase(), role, created_by: callerAuth.id },
      });
    } catch {
      // Non-fatal
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: profileData,
        temporaryPassword: userPassword,
        email: email.trim().toLowerCase(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );
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
