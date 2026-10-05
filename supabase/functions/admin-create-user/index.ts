// supabase/functions/admin-create-user/index.ts
// Edge Function: Create an auth user + app_users profile server-side.
// Requires: caller JWT with super_admin role.
// Uses service role key — never exposed to the client.

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
    // 1. Verify caller is super_admin via their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller using their JWT (anon key for auth, not service role)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerAuth }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerAuth) {
      return errorResponse('Unauthorized', 401);
    }

    // Check caller's role server-side
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: profileError } = await serviceClient
      .from('app_users')
      .select('role, status')
      .eq('id', callerAuth.id)
      .single();

    if (profileError || !callerProfile || callerProfile.status !== 'active') {
      return errorResponse('Forbidden: active account required', 403);
    }

    // 2. Validate input
    const body = await req.json();
    const { email, password, username, designation, role, linked_member_reg_no } = body;

    // Allow super_admin to create any user role; allow editor to create member portal accounts
    const isSuperAdmin = callerProfile.role === 'super_admin';
    const isEditorCreatingMember = callerProfile.role === 'editor' && role === 'member';

    if (!isSuperAdmin && !isEditorCreatingMember) {
      return errorResponse('Forbidden: super_admin or editor (member role only) required', 403);
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return errorResponse('Invalid email', 400);
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

    // 3. Create auth user with password or send invite email
    let newUserId: string;
    if (password && typeof password === 'string' && password.length >= 8) {
      const { data: createData, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { created_by_admin: true, intended_role: role },
      });
      if (createError) {
        console.error('Create error:', createError.message);
        return errorResponse(createError.message || 'Failed to create user', 400);
      }
      newUserId = createData.user.id;
    } else {
      const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
        data: { created_by_admin: true, intended_role: role },
      });
      if (inviteError) {
        console.error('Invite error:', inviteError.message);
        return errorResponse('Failed to create user. Check logs.', 500);
      }
      newUserId = inviteData.user.id;
    }

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
      // Rollback: delete the auth user since profile creation failed
      await serviceClient.auth.admin.deleteUser(newUserId);
      console.error('Profile insert error:', insertError.message);
      return errorResponse('Failed to create user profile. Auth user rolled back.', 500);
    }

    return new Response(JSON.stringify({ success: true, user: profileData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
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
