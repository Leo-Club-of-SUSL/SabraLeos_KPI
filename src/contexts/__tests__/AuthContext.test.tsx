import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '../../lib/supabase';
import { userService } from '../../services/user-service';
import type { SessionContext } from '../../services/user-service';
import type { Session, User } from '@supabase/supabase-js';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

vi.mock('../../services/user-service', () => ({
  userService: {
    getSessionContext: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('../../services/log-service', () => ({
  logService: {
    logLogin: vi.fn(),
  },
}));

describe('AuthContext Startup & Session Handling', () => {
  let authChangeCallback: (event: string, session: Session | null) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.onAuthStateChange as unknown as Mock).mockImplementation((cb: (event: string, session: Session | null) => void) => {
      authChangeCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  it('initializes with loading state and resolves with session context from single RPC', async () => {
    const mockUser = { id: 'usr-123', email: 'officer@nexus.org' } as User;
    const mockContext: SessionContext = {
      valid: true,
      id: 'usr-123',
      username: 'officer_1',
      designation: 'President',
      role: 'super_admin',
      status: 'active',
      linked_member_reg_no: '20ABC1001',
      created_at: '2026-01-01T00:00:00Z',
    };

    (userService.getSessionContext as unknown as Mock).mockResolvedValue(mockContext);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);

    // Simulate INITIAL_SESSION event
    act(() => {
      authChangeCallback('INITIAL_SESSION', { user: mockUser } as unknown as Session);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user?.id).toBe('usr-123');
    expect(result.current.appUser?.role).toBe('super_admin');
    expect(result.current.appUser?.username).toBe('officer_1');
    expect(userService.getSessionContext).toHaveBeenCalledTimes(1);
    // Profile is directly constructed from session context — no extra getCurrentUser call
    expect(userService.getCurrentUser).not.toHaveBeenCalled();
  });

  it('fails closed and terminates session if user is suspended', async () => {
    const mockUser = { id: 'usr-456', email: 'suspended@nexus.org' } as User;
    const mockSuspendedContext: SessionContext = {
      valid: false,
      status: 'suspended',
      reason: 'inactive_or_missing',
    };

    (userService.getSessionContext as unknown as Mock).mockResolvedValue(mockSuspendedContext);
    (supabase.auth.signOut as unknown as Mock).mockResolvedValue({ error: null });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      authChangeCallback('INITIAL_SESSION', { user: mockUser } as unknown as Session);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.appUser).toBeNull();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('does not re-fetch profile on TOKEN_REFRESHED for the same user', async () => {
    const mockUser = { id: 'usr-789', email: 'member@nexus.org' } as User;
    const mockContext: SessionContext = {
      valid: true,
      id: 'usr-789',
      username: 'member_john',
      designation: 'Member',
      role: 'member',
      status: 'active',
      linked_member_reg_no: '22ABC1234',
    };

    (userService.getSessionContext as unknown as Mock).mockResolvedValue(mockContext);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      authChangeCallback('INITIAL_SESSION', { user: mockUser } as unknown as Session);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(userService.getSessionContext).toHaveBeenCalledTimes(1);

    // Trigger TOKEN_REFRESHED
    act(() => {
      authChangeCallback('TOKEN_REFRESHED', { user: { ...mockUser, email: 'member@nexus.org' } } as unknown as Session);
    });

    // Should NOT call getSessionContext a 2nd time
    expect(userService.getSessionContext).toHaveBeenCalledTimes(1);
  });
});
