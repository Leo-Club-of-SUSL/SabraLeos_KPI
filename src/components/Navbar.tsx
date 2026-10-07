import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  UserCog,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  KeyRound,
} from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';

interface NavbarProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

export function Navbar({ currentPage = 'dashboard', onNavigate }: NavbarProps) {
  const { appUser, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const isMember = appUser?.role === 'member';

  const navigation = [
    { id: 'dashboard', label: isMember ? 'My Portal' : 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'editor', 'viewer', 'member'] },
    { id: 'members', label: 'Members', icon: Users, roles: ['super_admin', 'editor', 'viewer'] },
    { id: 'reports', label: 'Reports', icon: FileText, roles: ['super_admin', 'editor', 'viewer'] },
    { id: 'users', label: 'Settings', icon: UserCog, roles: ['super_admin'] },
  ];

  const filteredNav = navigation.filter((item) =>
    appUser?.role && item.roles.includes(appUser.role)
  );


  const handleNavClick = (pageId: string) => {
    if (onNavigate) {
      onNavigate(pageId);
    }
    setMobileMenuOpen(false);
  };

  return (
    <nav className="glass-panel sticky top-0 z-50 transition-all duration-300">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-maroon-500/20 overflow-hidden bg-white">
                <img src="/images/Round_logo.png" alt="SabraLeos Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  SabraLeos
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">KPI System</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${isActive
                        ? 'bg-maroon-50 dark:bg-maroon-500/10 text-maroon-700 dark:text-neon-blue border border-maroon-100 dark:border-maroon-500/20 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'dark:text-neon-blue' : ''}`} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right mr-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {appUser?.username || 'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {appUser?.designation || 'Member'}
              </p>
            </div>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 transition-colors duration-200"
              title="Change Password"
              aria-label="Change Password"
            >
              <KeyRound className="w-5 h-5" />
            </button>

            <button
              onClick={(e) => toggleTheme(e)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 transition-colors duration-200"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={signOut}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors duration-200 border border-transparent dark:border-white/5"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-white/5">
            <div className="flex flex-col gap-2">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${isActive
                        ? 'bg-maroon-50 dark:bg-maroon-500/10 text-maroon-700 dark:text-neon-blue'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowPasswordModal(true);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <KeyRound className="w-5 h-5" />
                <span className="font-medium">Change Password</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200 mt-2 border-t border-gray-200 dark:border-white/5 pt-4"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </nav>
  );
}
