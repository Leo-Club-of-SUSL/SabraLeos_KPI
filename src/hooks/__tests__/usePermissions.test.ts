import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '../../hooks/usePermissions';

// Mock the useAuth hook
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';

const mockUseAuth = vi.mocked(useAuth);

function setRole(role: 'super_admin' | 'editor' | 'viewer' | 'member' | null) {
    mockUseAuth.mockReturnValue({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        user: role ? { id: 'test-user' } as any : null,
        appUser: role
            ? {
                id: 'test-user',
                username: 'Test',
                designation: 'Test',
                role,
                status: 'active',
                linked_member_reg_no: null,
                created_at: new Date().toISOString(),
            }
            : null,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
        refreshUser: vi.fn(),
    });
}

describe('usePermissions', () => {
    it('super_admin has full permissions', () => {
        setRole('super_admin');
        const { result } = renderHook(() => usePermissions());

        expect(result.current.canEdit).toBe(true);
        expect(result.current.canManageUsers).toBe(true);
        expect(result.current.isSuperAdmin).toBe(true);
        expect(result.current.isEditor).toBe(false);
        expect(result.current.isViewer).toBe(false);
        expect(result.current.isMember).toBe(false);
        expect(result.current.canViewAdminDashboard).toBe(true);
        expect(result.current.role).toBe('super_admin');
    });

    it('editor can edit but not manage users', () => {
        setRole('editor');
        const { result } = renderHook(() => usePermissions());

        expect(result.current.canEdit).toBe(true);
        expect(result.current.canManageUsers).toBe(false);
        expect(result.current.isSuperAdmin).toBe(false);
        expect(result.current.isEditor).toBe(true);
        expect(result.current.isViewer).toBe(false);
        expect(result.current.isMember).toBe(false);
        expect(result.current.canViewAdminDashboard).toBe(true);
        expect(result.current.role).toBe('editor');
    });

    it('viewer is read-only', () => {
        setRole('viewer');
        const { result } = renderHook(() => usePermissions());

        expect(result.current.canEdit).toBe(false);
        expect(result.current.canManageUsers).toBe(false);
        expect(result.current.isSuperAdmin).toBe(false);
        expect(result.current.isEditor).toBe(false);
        expect(result.current.isViewer).toBe(true);
        expect(result.current.isMember).toBe(false);
        expect(result.current.canViewAdminDashboard).toBe(true);
        expect(result.current.role).toBe('viewer');
    });

    it('member has restricted member portal permissions', () => {
        setRole('member');
        const { result } = renderHook(() => usePermissions());

        expect(result.current.canEdit).toBe(false);
        expect(result.current.canManageUsers).toBe(false);
        expect(result.current.isSuperAdmin).toBe(false);
        expect(result.current.isEditor).toBe(false);
        expect(result.current.isViewer).toBe(false);
        expect(result.current.isMember).toBe(true);
        expect(result.current.canViewAdminDashboard).toBe(false);
        expect(result.current.role).toBe('member');
    });

    it('returns undefined role when no user is logged in', () => {
        setRole(null);
        const { result } = renderHook(() => usePermissions());

        expect(result.current.canEdit).toBe(false);
        expect(result.current.canManageUsers).toBe(false);
        expect(result.current.role).toBeUndefined();
    });
});

