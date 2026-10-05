import { useState } from 'react';
import { userService } from '../services/user-service';
import { validatePassword } from '../lib/sanitize';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validatePassword(password);
    if (!validation.isValid) {
      setError('Password requirements: ' + validation.errors.join(', '));
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await userService.changeOwnPassword(password);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const passwordVal = validatePassword(password);
  const colors = { weak: 'bg-red-500', fair: 'bg-amber-500', strong: 'bg-green-500' };
  const widths = { weak: 'w-1/3', fair: 'w-2/3', strong: 'w-full' };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="glass-panel bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="bg-gradient-to-r from-maroon-600 to-maroon-800 p-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-md">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Change Password</h3>
              <p className="text-xs text-maroon-100">Update your account password</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Password updated successfully!</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Enter new password"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {password && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full ${colors[passwordVal.strength]} ${widths[passwordVal.strength]} transition-all duration-300`} />
                </div>
                <p className={`text-[11px] ${passwordVal.isValid ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {passwordVal.isValid ? `✓ Valid password (${passwordVal.strength})` : passwordVal.errors.join(' • ')}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Confirm new password"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white rounded-xl text-sm font-bold shadow-md shadow-maroon-600/20 transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
