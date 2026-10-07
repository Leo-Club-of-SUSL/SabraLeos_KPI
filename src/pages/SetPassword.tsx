import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { validateStrongPassword, checkPwnedPassword } from '../lib/password-validator';
import { ShieldCheck, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2, Lock, Sun, Moon } from 'lucide-react';

export function SetPassword() {
  const { theme, toggleTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if user reached this page with a valid invite / recovery token, PKCE code, or active recovery session
    const checkRecoverySession = async () => {
      try {
        // 1. Check for active session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setHasValidSession(true);
          setSessionChecking(false);
          return;
        }

        // 2. Check for PKCE 'code' query parameter
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const type = (searchParams.get('type') as any) || 'invite';

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            setHasValidSession(true);
            setSessionChecking(false);
            return;
          }
        }

        // 3. Check for token_hash OTP verification
        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type,
          });
          if (!error && data.session) {
            setHasValidSession(true);
            setSessionChecking(false);
            return;
          }
        }

        // 4. Listen for auth state change from URL hash fragment exchange
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (
            event === 'PASSWORD_RECOVERY' || 
            event === 'SIGNED_IN' || 
            event === 'USER_UPDATED' ||
            (newSession && newSession.user)
          ) {
            setHasValidSession(true);
            setSessionChecking(false);
          }
        });

        // Give hash exchange 2 seconds to parse before concluding
        setTimeout(() => {
          setSessionChecking(false);
        }, 2000);

        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (err) {
        console.warn('Session recovery check error:', err);
      } finally {
        setTimeout(() => setSessionChecking(false), 2000);
      }
    };

    checkRecoverySession();
  }, []);

  const pwdValidation = validateStrongPassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pwdValidation.isValid) {
      setError(pwdValidation.errors.join(' '));
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      // K-Anonymity HIBP range check
      const isPwned = await checkPwnedPassword(password);
      if (isPwned) {
        setError('This password has appeared in a known data breach. For your protection, please choose a different password.');
        setLoading(false);
        return;
      }

      // Update password via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      // Log security event
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.rpc('log_security_event', {
            p_event_type: 'PASSWORD_CHANGED',
            p_target_user_id: user.id,
            p_details: { type: 'invite_or_recovery_completed' },
          });
        }
      } catch {
        // Non-fatal
      }

      // Strip sensitive hash tokens from URL
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password. Link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const colors = { weak: 'bg-red-500', fair: 'bg-amber-500', strong: 'bg-emerald-500' };
  const widths = { weak: 'w-1/3', fair: 'w-2/3', strong: 'w-full' };

  if (sessionChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center glass-panel p-8 rounded-2xl max-w-sm w-full">
          <Loader2 className="w-10 h-10 animate-spin text-maroon-600 dark:text-neon-blue mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Verifying secure setup link...</p>
        </div>
      </div>
    );
  }

  if (!hasValidSession && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto shadow-md">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Link Invalid or Expired</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            This password setup or recovery link is no longer valid. Links expire quickly for your account's security.
          </p>
          <div className="pt-3 space-y-2">
            <a
              href="/#forgot-password"
              className="block w-full py-2.5 px-4 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
            >
              Request New Reset Link
            </a>
            <a
              href="/"
              className="block w-full py-2.5 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Return to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
      {/* Ambient background glow accents */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-maroon-500/15 dark:bg-maroon-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-500/15 dark:bg-neon-blue/15 rounded-full blur-3xl pointer-events-none" />

      {/* Theme toggle button top right */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2.5 rounded-2xl glass-panel bg-white/70 dark:bg-gray-800/70 border border-gray-200/80 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:text-maroon-600 dark:hover:text-neon-blue shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2 text-xs font-semibold"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-maroon-600" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>
      </div>

      <div className="glass-panel bg-white/85 dark:bg-gray-800/90 rounded-3xl shadow-2xl max-w-md w-full border border-gray-200/80 dark:border-white/10 overflow-hidden backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-r from-maroon-700 via-maroon-800 to-amber-700 dark:from-maroon-900 dark:via-maroon-950 dark:to-gray-900 p-8 text-white text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-3 shadow-md">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Set Account Password</h2>
          <p className="text-xs text-amber-200/90 mt-1">SabraLeos KPI System — Zero-Knowledge Security</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <span>Password set successfully! Redirecting to portal...</span>
            </div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                placeholder="Min 10 chars, uppercase, lowercase, digit, symbol"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none pr-10 text-sm"
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
                  {pwdValidation.isValid ? '✓ Strong password (meets zero-knowledge security standard)' : pwdValidation.errors.join(' • ')}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm new password"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3 px-4 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-maroon-600/20 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Setting Password...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> Save Password & Enter Portal
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
