import { useState } from 'react';
import { userService } from '../services/user-service';
import { validateStrongPassword, checkPwnedPassword } from '../lib/password-validator';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, X, ShieldCheck } from 'lucide-react';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const pwdValidation = validateStrongPassword(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current password to verify your identity.');
      return;
    }

    if (!pwdValidation.isValid) {
      setError(pwdValidation.errors.join(' '));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      // K-Anonymity HIBP check
      const isPwned = await checkPwnedPassword(newPassword);
      if (isPwned) {
        setError('This password has appeared in a known data breach. For your security, please choose a different password.');
        setLoading(false);
        return;
      }

      await userService.changeOwnPassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password. Please verify current password.');
    } finally {
      setLoading(false);
    }
  };

  const colors = { weak: 'bg-red-500', fair: 'bg-amber-500', strong: 'bg-emerald-500' };
  const widths = { weak: 'w-1/3', fair: 'w-2/3', strong: 'w-full' };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="glass-panel bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-maroon-600 to-maroon-800 p-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-md">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Change Password</h3>
              <p className="text-xs text-maroon-100">Zero-knowledge secure password update</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Password updated! Other sessions have been revoked.</span>
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password to confirm identity"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={10}
                placeholder="Min 10 chars, uppercase, lowercase, digit, symbol"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors[pwdValidation.strength]} ${widths[pwdValidation.strength]} transition-all duration-300 rounded-full`}
                  />
                </div>
                <p
                  className={`text-[11px] font-medium ${
                    pwdValidation.isValid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {pwdValidation.isValid ? '✓ Strong password' : pwdValidation.errors.join(' • ')}
                </p>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter new password"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none text-sm"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newPassword || !currentPassword}
              className="flex-1 px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-maroon-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Save Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
