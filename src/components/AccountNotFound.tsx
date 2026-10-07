import { useState, useEffect } from 'react';
import { LogOut, RefreshCw, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/user-service';

export function AccountNotFound() {
  const { user, signOut } = useAuth();
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const data = await userService.getCurrentUser();
        if (!data) {
          setFetchError('User profile could not be loaded for your authenticated session.');
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    };
    checkUser();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      window.location.reload();
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-maroon-950 to-gray-900 flex items-center justify-center p-4">
      <div className="glass-panel bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-lg w-full border border-gray-200 dark:border-white/10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Account Profile Pending
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
            Your login was authenticated, but your member profile has not been assigned a role or linked yet.
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 mb-6 space-y-3">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Please contact your club Super Admin or System Administrator to verify your member account status.
          </p>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors pt-2 border-t border-gray-200 dark:border-gray-700"
          >
            <span>Technical Diagnostics</span>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDetails && (
            <div className="text-[11px] font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 break-all space-y-1">
              <div>Auth UID: {user.id}</div>
              <div>Email: {user.email || 'N/A'}</div>
              {fetchError && <div className="text-red-500 dark:text-red-400 font-semibold">{fetchError}</div>}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-maroon-600/20 flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Retry
          </button>
          <button
            onClick={() => signOut()}
            className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
