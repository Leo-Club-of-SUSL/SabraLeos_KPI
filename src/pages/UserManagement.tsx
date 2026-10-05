import { useState, useEffect } from 'react';
import { userService } from '../services/user-service';
import { memberService } from '../services/member-service';
import { systemService, type SecurityAlert } from '../services/system-service';
import { 
  UserPlus, Shield, Edit as EditIcon, Eye, Loader2, X, Trash2, 
  Settings, Users as UsersIcon, ListTree, UserCheck, UserX, 
  User, Send, ShieldAlert, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { SystemDataManagement } from '../components/SystemDataManagement';
import { SystemLogs } from '../components/SystemLogs';
import type { AppUser, Member, AppUserRole } from '../types/database';
import { usePermissions } from '../hooks/usePermissions';

export function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'security' | 'system' | 'logs'>('users');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<{ matches: boolean; current: string | null; expected: string } | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const permissions = usePermissions();

  useEffect(() => {
    loadData();
    checkSchema();
  }, []);

  const checkSchema = async () => {
    try {
      const res = await systemService.checkSchemaVersion();
      setSchemaStatus(res);
    } catch (err) {
      console.warn('Schema version check error:', err);
    }
  };

  const loadData = async () => {
    try {
      const [usersData, membersData, alertsData] = await Promise.all([
        userService.getAll(),
        memberService.getAll(),
        systemService.getSecurityAlerts(false).catch(() => []),
      ]);
      setUsers(usersData);
      setMembers(membersData);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    const isSuspending = user.status === 'active';
    const action = isSuspending ? 'suspend' : 'reactivate';

    if (isSuspending && user.role === 'super_admin') {
      const activeSuperAdmins = users.filter(u => u.role === 'super_admin' && u.status === 'active').length;
      if (activeSuperAdmins <= 1) {
        alert('Cannot suspend the last active Super Admin.');
        return;
      }
    }

    if (!confirm(`Are you sure you want to ${action} user "${user.username || user.id.substring(0, 8)}"?`)) {
      return;
    }

    try {
      setActionLoadingId(user.id);
      await userService.setStatus(user.id, action);
      setActionMessage({ type: 'success', text: `User successfully ${action}ed.` });
      await loadData();
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      setActionMessage({ type: 'error', text: `Failed to ${action} user: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendResetEmail = async (user: AppUser) => {
    const member = members.find(m => m.reg_no === user.linked_member_reg_no);
    const email = member?.email;
    if (!email) {
      const inputEmail = prompt(`Please enter the verified email address for user "${user.username || 'User'}":`);
      if (!inputEmail || !inputEmail.includes('@')) return;
      return sendResetToEmail(inputEmail);
    }
    return sendResetToEmail(email);
  };

  const sendResetToEmail = async (email: string) => {
    try {
      setActionLoadingId(email);
      await userService.sendPasswordResetEmail(email);
      setActionMessage({ type: 'success', text: `Password recovery email sent securely to ${email}.` });
    } catch (err) {
      setActionMessage({ type: 'error', text: `Failed to send reset email: ${err instanceof Error ? err.message : 'Service unavailable'}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetMfa = async (user: AppUser) => {
    if (!confirm(`Reset MFA factors for user "${user.username || user.id.substring(0, 8)}"? This will require them to re-enroll next login.`)) {
      return;
    }
    try {
      setActionLoadingId(user.id);
      await userService.resetMfa(user.id);
      setActionMessage({ type: 'success', text: `MFA factors reset for ${user.username}.` });
      await loadData();
    } catch (err) {
      setActionMessage({ type: 'error', text: `Failed to reset MFA: ${err instanceof Error ? err.message : 'Service error'}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (userId: string, username: string, userRole: string) => {
    if (userRole === 'super_admin') {
      const superAdminCount = users.filter(u => u.role === 'super_admin').length;
      if (superAdminCount <= 1) {
        alert('Cannot delete the last Super Admin. At least one Super Admin must remain in the system.');
        return;
      }
    }

    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoadingId(userId);
      await userService.delete(userId);
      setActionMessage({ type: 'success', text: 'User removed.' });
      await loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      setActionMessage({ type: 'error', text: `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="w-5 h-5 text-red-500" />;
      case 'editor':
        return <EditIcon className="w-5 h-5 text-blue-500" />;
      case 'viewer':
        return <Eye className="w-5 h-5 text-gray-500" />;
      case 'member':
        return <User className="w-5 h-5 text-emerald-500" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Viewer';
      case 'member':
        return 'Member';
      default:
        return role;
    }
  };

  const getMemberName = (regNo: string | null) => {
    if (!regNo) return '-';
    const member = members.find((m) => m.reg_no === regNo);
    return member ? `${member.name_with_initials} (${regNo})` : regNo;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  // Access control check
  if (!permissions.canAccessManagement) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage system users and permissions
          </p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to access User Management. Only Super Admins can manage users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schema Version Mismatch Banner */}
      {schemaStatus && !schemaStatus.matches && (
        <div className="p-4 bg-red-600 text-white rounded-xl shadow-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bold">CRITICAL: Database Schema Mismatch Detected</p>
              <p className="text-sm text-red-100">
                Current DB version: <code>{schemaStatus.current}</code> • App expected version: <code>{schemaStatus.expected}</code>.
                Write operations may fail until the latest database migration is applied via <code>supabase db push</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className={`p-4 rounded-xl flex items-center justify-between ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
            : 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="text-sm font-medium">{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            User Management & Security
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Zero-knowledge account provisioning, role-based access, and security overview
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl w-fit flex-wrap gap-1">
          {permissions.canManageUsers && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs tracking-wider transition-all duration-200 ${
                activeTab === 'users'
                  ? 'bg-white dark:bg-gray-700 text-maroon-600 dark:text-neon-blue shadow-lg'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <UsersIcon className="w-4 h-4" />
              USER ACCOUNTS
            </button>
          )}

          {permissions.isSuperAdmin && (
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs tracking-wider transition-all duration-200 ${
                activeTab === 'security'
                  ? 'bg-white dark:bg-gray-700 text-maroon-600 dark:text-neon-blue shadow-lg'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              SECURITY OVERVIEW {alerts.length > 0 && `(${alerts.length})`}
            </button>
          )}

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs tracking-wider transition-all duration-200 ${
              activeTab === 'system'
                ? 'bg-white dark:bg-gray-700 text-maroon-600 dark:text-neon-blue shadow-lg'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            SYSTEM DATA
          </button>

          {permissions.canViewLogs && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs tracking-wider transition-all duration-200 ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-gray-700 text-maroon-600 dark:text-neon-blue shadow-lg'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <ListTree className="w-4 h-4" />
              AUDIT LOGS
            </button>
          )}
        </div>

        {activeTab === 'users' && permissions.isSuperAdmin && (
          <button
            onClick={() => {
              setEditingUser(null);
              setShowCreateForm(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-md text-sm shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Invite Officer
          </button>
        )}
      </div>

      {activeTab === 'users' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User / Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Linked Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-9 h-9 rounded-full bg-maroon-100 dark:bg-maroon-900/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-maroon-600 dark:text-maroon-400">
                              {(user.username || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {user.username || `User (${user.id.substring(0, 8)})`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {user.designation || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(user.role)}
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {getRoleLabel(user.role)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            user.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {user.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {getMemberName(user.linked_member_reg_no)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end items-center gap-1.5">
                          {/* Send Reset Email */}
                          <button
                            onClick={() => handleSendResetEmail(user)}
                            disabled={actionLoadingId === user.id}
                            className="p-1.5 text-maroon-600 hover:text-maroon-900 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-maroon-50 dark:hover:bg-maroon-900/20 rounded-lg transition-colors"
                            title="Send Password Recovery Email to User"
                          >
                            <Send className="w-4 h-4" />
                          </button>

                          {/* Reset MFA */}
                          <button
                            onClick={() => handleResetMfa(user)}
                            disabled={actionLoadingId === user.id}
                            className="p-1.5 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Reset User MFA Factors"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>

                          {/* Suspend / Reactivate button */}
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={actionLoadingId === user.id}
                            className={`p-1.5 rounded-lg transition-colors ${
                              user.status === 'active'
                                ? 'text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                            title={user.status === 'active' ? 'Suspend User' : 'Reactivate User'}
                          >
                            {actionLoadingId === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : user.status === 'active' ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>

                          {/* Edit Details */}
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setShowCreateForm(true);
                            }}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit Role / Designation"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(user.id, user.username || user.id, user.role)}
                            disabled={user.role === 'super_admin' && users.filter(u => u.role === 'super_admin').length <= 1}
                            className={`p-1.5 rounded-lg transition-colors ${user.role === 'super_admin' && users.filter(u => u.role === 'super_admin').length <= 1
                              ? 'text-gray-300 cursor-not-allowed dark:text-gray-600'
                              : 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                              }`}
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECURITY OVERVIEW TAB */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Security Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Privileged Officers</span>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                {users.filter(u => ['super_admin', 'editor'].includes(u.role)).length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Super Admins & Editors</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Users</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {users.filter(u => u.status === 'active').length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total enabled logins</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Suspended Accounts</span>
              <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
                {users.filter(u => u.status === 'suspended').length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Access locked out</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Security Alerts</span>
              <p className="text-2xl font-black text-maroon-600 dark:text-neon-blue mt-1">
                {alerts.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Unresolved security alerts</p>
            </div>
          </div>

          {/* Security Alerts List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Active Security Alerts
            </h3>

            {alerts.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-gray-800 dark:text-gray-200">System Healthy</p>
                <p className="text-xs mt-1">No unhandled security alerts or anomalies detected.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          alert.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white text-sm">{alert.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{alert.description}</p>
                      <span className="text-[11px] text-gray-400 mt-2 block">{new Date(alert.created_at).toLocaleString()}</span>
                    </div>
                    <button
                      onClick={async () => {
                        await systemService.resolveSecurityAlert(alert.id);
                        loadData();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shrink-0"
                    >
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'system' && <SystemDataManagement />}
      {activeTab === 'logs' && <SystemLogs />}

      {showCreateForm && (
        <UserModal
          user={editingUser}
          members={members}
          onSuccess={() => {
            setShowCreateForm(false);
            setEditingUser(null);
            loadData();
          }}
          onCancel={() => {
            setShowCreateForm(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}

interface UserModalProps {
  user?: AppUser | null;
  members: Member[];
  onSuccess: () => void;
  onCancel: () => void;
}

function UserModal({ user, members, onSuccess, onCancel }: UserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    username: user?.username || '',
    designation: user?.designation || '',
    role: (user?.role || 'viewer') as AppUserRole,
    linkedMemberRegNo: user?.linked_member_reg_no || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (user) {
        await userService.update(user.id, {
          username: formData.username,
          designation: formData.designation,
          role: formData.role,
          linked_member_reg_no: formData.linkedMemberRegNo || null,
        });
        setSuccessMessage('User updated successfully!');
      } else {
        if (!formData.email) {
          throw new Error('Email address is required to invite an officer.');
        }

        await userService.create(formData.email, {
          username: formData.username,
          designation: formData.designation,
          role: formData.role,
          linked_member_reg_no: formData.linkedMemberRegNo || null,
        });
        setSuccessMessage('Invitation link sent to user email!');
      }

      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message || `Failed to ${user ? 'update' : 'create'} user`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {user ? 'Edit Officer Account' : 'Invite New Officer'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Official Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="officer@leoclubsusl.lk"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                A secure setup invitation link will be emailed to this address.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Officer Display Name / Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              placeholder="e.g. kavindu_gunasekara"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Designation <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              required
              placeholder="Director - Service Projects"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assigned Role <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  role: e.target.value as AppUserRole,
                })
              }
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="viewer">Viewer (Read-only)</option>
              <option value="editor">Editor (Can add/edit operations & points)</option>
              <option value="super_admin">Super Admin (Full administrative access & settings)</option>
              <option value="member">Member (Self-service member portal)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Link to Member (Optional)
            </label>
            <select
              value={formData.linkedMemberRegNo}
              onChange={(e) => setFormData({ ...formData, linkedMemberRegNo: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">No linked member</option>
              {members.map((member) => (
                <option key={member.reg_no} value={member.reg_no}>
                  {member.name_with_initials} ({member.reg_no})
                </option>
              ))}
            </select>
          </div>

          {successMessage && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm text-emerald-800 dark:text-emerald-300">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {user ? 'Saving...' : 'Sending Invite...'}
                </>
              ) : (
                user ? 'Save Changes' : 'Send Invite'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
