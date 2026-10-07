import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
    const { appUser } = useAuth();

    const isSuperAdmin = appUser?.role === 'super_admin';
    const isEditor = appUser?.role === 'editor';
    const isViewer = appUser?.role === 'viewer';
    const isMember = appUser?.role === 'member' || (!isSuperAdmin && !isEditor && !isViewer);

    const canEdit = isSuperAdmin || isEditor;
    const canManageUsers = isSuperAdmin;
    const canViewLogs = isSuperAdmin || isEditor;
    const canAccessManagement = isSuperAdmin || isEditor;
    const canViewAdminDashboard = isSuperAdmin || isEditor || isViewer;

    return {
        canEdit,
        canManageUsers,
        canViewLogs,
        canAccessManagement,
        canViewAdminDashboard,
        isViewer,
        isEditor,
        isSuperAdmin,
        isMember,
        role: appUser?.role,
    };
}
