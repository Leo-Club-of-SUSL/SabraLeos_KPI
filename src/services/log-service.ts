import { supabase } from '../lib/supabase';

/**
 * logService — read-only client interface.
 *
 * Phase 1 security hardening:
 * - Direct INSERT into system_logs from the client is REMOVED.
 *   All writes go through SECURITY DEFINER RPCs (log_login, log_export)
 *   or DB triggers. This prevents log forgery.
 * - Officers can still READ logs via getLogs().
 * - log_login() and log_export() are the only client-callable write paths.
 */
export const logService = {
  /**
   * Log an officer login event. Derives identity from auth.uid() server-side.
   * No-op if the caller is not an officer (guard inside the RPC).
   */
  async logLogin(): Promise<void> {
    try {
      const { error } = await supabase.rpc('log_login' as never);
      if (error) console.warn('Login log failed (non-fatal):', error.message);
    } catch (err) {
      console.warn('Login log error (non-fatal):', err);
    }
  },

  /**
   * Log an export event. Derives identity from auth.uid() server-side.
   * Throws if the caller is not an officer.
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
      // 1. Try ordering by timestamp first (legacy schema)
      const resTimestamp = await supabase
        .from('system_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (!resTimestamp.error && resTimestamp.data) {
        return resTimestamp.data;
      }
    } catch {
      // Fallback
    }

    try {
      // 2. Try ordering by created_at (newer schema)
      const resCreatedAt = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!resCreatedAt.error && resCreatedAt.data) {
        return resCreatedAt.data;
      }
    } catch {
      // Fallback
    }

    try {
      // 3. Fallback to unordered query
      const resFallback = await supabase
        .from('system_logs')
        .select('*')
        .limit(200);

      if (resFallback.error) {
        console.warn('System logs fetch warning:', resFallback.error.message);
        return [];
      }
      return resFallback.data || [];
    } catch {
      return [];
    }
  },

  /**
   * Read security events (auth anomalies, threats, password/MFA resets, status changes).
   * Only officers can read (enforced by RLS).
   */
  async getSecurityEvents() {
    try {
      const res1 = await supabase
        .from('security_events')
        .select('id, event_type, user_id, actor_id, ip_address, details, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!res1.error && res1.data) {
        return res1.data;
      }
    } catch {
      // Fallback
    }

    try {
      const res2 = await supabase
        .from('security_events')
        .select('*')
        .limit(200);

      if (res2.error) {
        console.warn('Security events fetch warning:', res2.error.message);
        return [];
      }
      return res2.data || [];
    } catch {
      return [];
    }
  },

  /**
   * Log a security or threat event via security definer RPC.
   */
  async logSecurityEvent(eventType: string, details?: Record<string, unknown>, targetUserId?: string): Promise<void> {
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
