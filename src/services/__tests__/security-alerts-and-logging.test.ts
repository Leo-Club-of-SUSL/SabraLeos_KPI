import { describe, it, expect, vi, beforeEach } from 'vitest';
import { systemService } from '../system-service';
import { logService } from '../log-service';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-uuid-123' } } }),
    },
  },
}));

describe('Security Alerts & Audit Logging Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('systemService Security Alerts', () => {
    it('resolveSecurityAlert calls RPC resolve_security_alert with action resolved', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

      await systemService.resolveSecurityAlert('alert-1', { custom: 'data' });

      expect(supabase.rpc).toHaveBeenCalledWith('resolve_security_alert', {
        p_alert_id: 'alert-1',
        p_action: 'resolved',
      });
    });

    it('ignoreSecurityAlert calls RPC resolve_security_alert with action ignored', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

      await systemService.ignoreSecurityAlert('alert-2', { details: 'info' });

      expect(supabase.rpc).toHaveBeenCalledWith('resolve_security_alert', {
        p_alert_id: 'alert-2',
        p_action: 'ignored',
      });
    });

    it('ignoreSecurityAlert falls back to direct table update if RPC fails or is missing', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'function not found' } } as any);
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

      await systemService.ignoreSecurityAlert('alert-3', { existing: 'meta' });

      expect(supabase.from).toHaveBeenCalledWith('security_alerts');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_resolved: true,
          resolved_by: 'admin-uuid-123',
          metadata: expect.objectContaining({
            existing: 'meta',
            status: 'ignored',
            is_ignored: true,
          }),
        })
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'alert-3');
    });

    it('reopenSecurityAlert reactivates alert', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

      await systemService.reopenSecurityAlert('alert-4');

      expect(supabase.rpc).toHaveBeenCalledWith('resolve_security_alert', {
        p_alert_id: 'alert-4',
        p_action: 'active',
      });
    });
  });

  describe('logService Login and Logout Logging', () => {
    it('logLogin logs to both activity stream (log_login) and security stream (log_security_event)', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

      await logService.logLogin('user-456', 'superadmin_zahi');

      expect(supabase.rpc).toHaveBeenCalledWith('log_login');
      expect(supabase.rpc).toHaveBeenCalledWith('log_security_event', {
        p_event_type: 'LOGIN',
        p_target_user_id: 'user-456',
        p_details: {
          username: 'superadmin_zahi',
          actor_username: 'superadmin_zahi',
          method: 'password',
          user_id: 'user-456',
        },
      });
    });

    it('logLogout logs to both activity stream (log_logout) and security stream (log_security_event) with actor_username', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

      await logService.logLogout('user-456', 'superadmin_zahi');

      expect(supabase.rpc).toHaveBeenCalledWith('log_logout');
      expect(supabase.rpc).toHaveBeenCalledWith('log_security_event', {
        p_event_type: 'LOGOUT',
        p_target_user_id: 'user-456',
        p_details: {
          username: 'superadmin_zahi',
          actor_username: 'superadmin_zahi',
          method: 'manual',
          user_id: 'user-456',
        },
      });
    });
  });
});
