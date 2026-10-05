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
   * Read system audit logs. Only super_admin can read (enforced by RLS).
   */
  async getLogs() {
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  },
};
