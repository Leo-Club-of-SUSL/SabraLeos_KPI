import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
    const { appUser } = useAuth();

    const canEdit = appUser?.role === 'super_admin' || appUser?.role === 'editor';
    const canManageUsers = appUser?.role === 'super_admin';
    const canViewLogs = appUser?.role === 'super_admin' || appUser?.role === 'editor';
    const canAccessManagement = appUser?.role === 'super_admin' || appUser?.role === 'editor';
    const isViewer = appUser?.role === 'viewer';
    const isEditor = appUser?.role === 'editor';
    const isSuperAdmin = appUser?.role === 'super_admin';

    return {
        canEdit,
        canManageUsers,
        canViewLogs,
        canAccessManagement,
        isViewer,
        isEditor,
        isSuperAdmin,
        role: appUser?.role,
    };
}
