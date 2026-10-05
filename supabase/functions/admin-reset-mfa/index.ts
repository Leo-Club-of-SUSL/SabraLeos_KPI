// supabase/functions/admin-reset-mfa/index.ts
// Super Admin resets an officer's MFA factor (super_admin only, audited)

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
    const { user_id } = body;

    if (!user_id) {
      return errorResponse('user_id is required', 400, corsHeaders);
    }

    // List factors for user and delete them
    const { data: factors, error: factorsError } = await serviceClient.auth.admin.mfa.listFactors({
      userId: user_id,
    });

    if (factorsError) {
      return errorResponse('Failed to query MFA factors', 500, corsHeaders);
    }

    if (factors?.factors && factors.factors.length > 0) {
      for (const factor of factors.factors) {
        await serviceClient.auth.admin.mfa.deleteFactor({
          userId: user_id,
          id: factor.id,
        });
      }
    }

    // Log security alert
    await serviceClient.from('security_alerts').insert({
      alert_type: 'MFA_RESET_BY_ADMIN',
      severity: 'high',
      title: 'MFA Reset for User',
      description: `MFA factors were cleared for user ${user_id} by Super Admin ${callerAuth.id}`,
      metadata: { target_user_id: user_id, actor_id: callerAuth.id },
    });

    return new Response(JSON.stringify({ success: true, message: 'MFA factors reset successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('MFA reset error:', err);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});

function errorResponse(message: string, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
    status,
  });
}
