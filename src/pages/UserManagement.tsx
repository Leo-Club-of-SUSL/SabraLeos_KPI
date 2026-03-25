import { useState, useEffect } from 'react';
import { userService } from '../services/user-service';
import { memberService } from '../services/member-service';
import { UserPlus, Shield, Edit as EditIcon, Eye, EyeOff, Loader2, X, Trash2, Settings, Users as UsersIcon, ListTree } from 'lucide-react';
import { SystemDataManagement } from '../components/SystemDataManagement';
import { SystemLogs } from '../components/SystemLogs';
import type { AppUser, Member } from '../types/database';
import { usePermissions } from '../hooks/usePermissions';
import { validatePassword } from '../lib/sanitize';

export function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'system' | 'logs'>('system');
  const permissions = usePermissions();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersData, membersData] = await Promise.all([
        userService.getAll(),
        memberService.getAll(),
      ]);
      setUsers(usersData);
      setMembers(membersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string, username: string, userRole: string) => {
    // Check if this is a super admin and if they're the last one
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
      const { error } = await userService.delete(userId);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
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
      default:
        return role;
    }
  };

  const getMemberName = (regNo: string | null) => {
    if (!regNo) return '-';
    const member = members.find((m) => m.reg_no === regNo);
    return member ? member.name_with_initials : regNo;
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage system users and permissions
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl w-fit">
          {permissions.canManageUsers && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-200 ${
                activeTab === 'users'
                  ? 'bg-white dark:bg-gray-700 text-maroon-600 dark:text-neon-blue shadow-lg scale-[1.02]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <UsersIcon className="w-4 h-4" />
              USER ACCOUNTS
            </button>
          )}
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-200 ${
              activeTab === 'system'
                ? 'bg-white dark:bg-gray-700 text-maroon-600 dark:text-neon-blue shadow-lg scale-[1.02]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            SYSTEM DATA
          </button>
          {permissions.canViewLogs && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-200 ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-gray-700 text-maroon-600 dark:text-neon-blue shadow-lg scale-[1.02]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <ListTree className="w-4 h-4" />
              SYSTEM LOGS
            </button>
          )}
        </div>

        {activeTab === 'users' && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-md"
          >
            <UserPlus className="w-5 h-5" />
            Create User
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
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
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
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
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
                          <div className="w-10 h-10 rounded-full bg-maroon-100 dark:bg-maroon-900/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-maroon-600 dark:text-maroon-400">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.designation}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(user.role)}
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {getRoleLabel(user.role)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {getMemberName(user.linked_member_reg_no)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setShowCreateForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <EditIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.username, user.role)}
                            disabled={user.role === 'super_admin' && users.filter(u => u.role === 'super_admin').length <= 1}
                            className={`p-2 rounded-lg transition-colors ${user.role === 'super_admin' && users.filter(u => u.role === 'super_admin').length <= 1
                              ? 'text-gray-300 cursor-not-allowed dark:text-gray-600'
                              : 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                              }`}
                            title={
                              user.role === 'super_admin' && users.filter(u => u.role === 'super_admin').length <= 1
                                ? 'Cannot delete the last Super Admin'
                                : 'Delete User'
                            }
                          >
                            <Trash2 className="w-5 h-5" />
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

      {activeTab === 'system' && <SystemDataManagement />}
      {activeTab === 'logs' && <SystemLogs />}

      {activeTab === 'users' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Role Descriptions
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-red-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Super Admin:</span> Can
                create users, manage all members and contributions
              </div>
            </div>
            <div className="flex items-start gap-2">
              <EditIcon className="w-4 h-4 text-blue-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Editor:</span> Can add
                members and contributions, but cannot create users
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-gray-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Viewer:</span> Read-only
                access to all data
              </div>
            </div>
          </div>
        </div>
      )}

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
    password: '',
    username: user?.username || '',
    designation: user?.designation || '',
    role: (user?.role || 'viewer') as 'super_admin' | 'editor' | 'viewer',
    linkedMemberRegNo: user?.linked_member_reg_no || '',
  });

  useEffect(() => {
    setFormData({
      email: '',
      password: '',
      username: user?.username || '',
      designation: user?.designation || '',
      role: (user?.role || 'viewer') as 'super_admin' | 'editor' | 'viewer',
      linkedMemberRegNo: user?.linked_member_reg_no || '',
    });
  }, [user]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validate password on create
    if (!user) {
      const passwordCheck = validatePassword(formData.password);
      if (!passwordCheck.isValid) {
        setError('Password requirements: ' + passwordCheck.errors.join(', '));
        return;
      }
    }

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
        await userService.create(formData.email, formData.password, {
          username: formData.username,
          designation: formData.designation,
          role: formData.role,
          linked_member_reg_no: formData.linkedMemberRegNo || null,
        });
        setSuccessMessage('User created successfully! Note: If email confirmation is enabled in Supabase, the user must confirm their email before logging in. See DISABLE_EMAIL_CONFIRMATION.md for details.');
      }

      // Close modal after a short delay to show success message
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message || `Failed to ${user ? 'update' : 'create'} user`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {user ? 'Edit User' : 'Create New User'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="user@example.com"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="Min 8 chars, uppercase, number, special"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {/* Password strength indicator */}
              {formData.password && (() => {
                const v = validatePassword(formData.password);
                const colors = { weak: 'bg-red-500', fair: 'bg-amber-500', strong: 'bg-green-500' };
                const widths = { weak: 'w-1/3', fair: 'w-2/3', strong: 'w-full' };
                return (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[v.strength]} ${widths[v.strength]} transition-all duration-300 rounded-full`} />
                    </div>
                    <p className={`text-xs mt-1 font-medium ${v.isValid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {v.isValid ? `✓ Strong enough (${v.strength})` : v.errors.join(' • ')}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              placeholder="johndoe"
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
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  role: e.target.value as 'super_admin' | 'editor' | 'viewer',
                })
              }
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="viewer">Viewer (Read-only)</option>
              <option value="editor">Editor (Can add/edit)</option>
              <option value="super_admin">Super Admin (Full access)</option>
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Link this user account to their member record for point accumulation
            </p>
          </div>

          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {user ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                user ? 'Save Changes' : 'Create User'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
