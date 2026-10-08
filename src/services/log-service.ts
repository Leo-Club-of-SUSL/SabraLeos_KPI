import { supabase } from '../lib/supabase';

/**
 * logService — secure logging service.
 *
 * All writes go through SECURITY DEFINER RPCs or DB triggers.
 * Direct INSERT from the client is blocked by RLS/REVOKE.
 * Officers can READ logs via getLogs() / getSecurityEvents().
 */
export const logService = {
  /**
   * Log an officer login event.
   * Called ONCE per successful login from AuthContext.signIn().
   * The RPC derives identity from auth.uid() server-side and has a 15-second debounce.
   */
  async logLogin(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('log_login');
      if (error) console.warn('Login log failed (non-fatal):', error.message);
    } catch (err) {
      console.warn('Login log error (non-fatal):', err);
    }
  },

  /**
   * Log a logout event with user ID and username.
   * Logs to both system_logs (via log_logout) and security_events (via log_security_event)
   * before the Supabase session is revoked.
   */
  async logLogout(userId: string, username: string): Promise<void> {
    try {
      // 1. Call dedicated log_logout RPC (activity audit stream)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resActivity = await (supabase.rpc as any)('log_logout');
      if (resActivity?.error) {
        console.warn('Activity logout log failed (non-fatal):', resActivity.error.message);
      }
    } catch {
      // non-fatal
    }

    try {
      // 2. Call log_security_event RPC (security audit stream)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resSecurity = await (supabase.rpc as any)('log_security_event', {
        p_event_type: 'LOGOUT',
        p_target_user_id: userId,
        p_details: { username, user_id: userId },
      });
      if (resSecurity?.error) {
        console.warn('Security logout log failed (non-fatal):', resSecurity.error.message);
      }
    } catch (err) {
      console.warn('Logout log error (non-fatal):', err);
    }
  },

  /**
   * Log an export event.
   */
  async logExport(details: Record<string, unknown>): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('log_export', { p_details: details });
      if (error) console.warn('Export log failed (non-fatal):', error.message);
    } catch (err) {
      console.warn('Export log error (non-fatal):', err);
    }
  },

  /**
   * Read system audit logs. Only officers can read (enforced by RLS).
   */
  async getLogs() {
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && data) return data;
    } catch {
      // Fallback
    }

    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (!error && data) return data;
    } catch {
      // Fallback
    }

    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .limit(200);

      if (error) {
        console.warn('System logs fetch warning:', error.message);
        return [];
      }
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Read security events. Only officers can read (enforced by RLS).
   */
  async getSecurityEvents() {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('id, event_type, user_id, actor_id, ip_address, details, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && data) return data;
    } catch {
      // Fallback
    }

    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .limit(200);

      if (error) {
        console.warn('Security events fetch warning:', error.message);
        return [];
      }
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Log a security/threat event via SECURITY DEFINER RPC.
   */
  async logSecurityEvent(
    eventType: string,
    details?: Record<string, unknown>,
    targetUserId?: string
  ): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('log_security_event', {
        p_event_type: eventType,
        p_target_user_id: targetUserId || null,
        p_details: details || {},
      });
      if (error) {
        console.warn('Security event log failed (non-fatal):', error.message);
      }
    } catch (err) {
      console.warn('Security event logging non-fatal error:', err);
    }
  },
};
