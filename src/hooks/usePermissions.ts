import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
    const { appUser } = useAuth();

    const isSuperAdmin = appUser?.role === 'super_admin';
    const isEditor = appUser?.role === 'editor';
    
    // Explicit Officer: Super Admin, Editor, or standalone Officer Viewer (no linked member reg no & non-member designation)
    const isOfficer = isSuperAdmin || isEditor || (
        appUser?.role === 'viewer' && 
        !appUser?.linked_member_reg_no && 
        appUser?.designation?.toLowerCase() !== 'member'
    );
    
    // Member: role === 'member', OR any non-admin account linked to a student member reg no, OR not an officer
    const isMember = appUser?.role === 'member' || 
        Boolean(appUser?.linked_member_reg_no && !isSuperAdmin && !isEditor) || 
        (!isOfficer && !isSuperAdmin && !isEditor);

    const isViewer = !isMember && appUser?.role === 'viewer';

    const canEdit = isSuperAdmin || isEditor;
    const canManageUsers = isSuperAdmin;
    const canViewLogs = isSuperAdmin || isEditor;
    const canAccessManagement = isSuperAdmin || isEditor;
    const canViewAdminDashboard = isOfficer;

    return {
        canEdit,
        canManageUsers,
        canViewLogs,
        canAccessManagement,
        canViewAdminDashboard,
        isOfficer,
        isViewer,
        isEditor,
        isSuperAdmin,
        isMember,
        role: appUser?.role,
    };
}

