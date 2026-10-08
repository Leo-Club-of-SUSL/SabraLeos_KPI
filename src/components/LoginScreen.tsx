import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { logService } from '../services/log-service';
import { LogIn, Loader2, Eye, EyeOff, ShieldAlert, Lock, Mail, Moon, Sun, Sparkles } from 'lucide-react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export function LoginScreen() {
  const { signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSubmittingRef = useRef(false);

  const isLockedOut = lockoutRemaining > 0;

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutRemaining > 0) {
      lockoutTimer.current = setInterval(() => {
        setLockoutRemaining((prev) => {
          if (prev <= 1) {
            if (lockoutTimer.current) clearInterval(lockoutTimer.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    };
  }, [lockoutRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut || loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      setFailedAttempts(0);
    } catch {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      // Log threat / security anomaly
      logService.logSecurityEvent('LOGIN_FAILED', {
        email: email.trim().toLowerCase(),
        attempt_number: newAttempts,
      });

      if (newAttempts >= MAX_ATTEMPTS) {
        setLockoutRemaining(LOCKOUT_SECONDS);
        setFailedAttempts(0);
        logService.logSecurityEvent('LOCKOUT_TRIGGERED', {
          email: email.trim().toLowerCase(),
          duration_seconds: LOCKOUT_SECONDS,
        });
        setError(`Too many failed attempts. Please wait ${LOCKOUT_SECONDS} seconds.`);
      } else {
        setError(`Invalid email or password. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

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

      {/* Floating Card Container */}
      <div className="w-full max-w-md glass-panel bg-white/85 dark:bg-gray-800/90 rounded-3xl shadow-2xl relative overflow-hidden border border-gray-200/80 dark:border-white/10 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-300">
        
        {/* Top Header with Branding */}
        <div className="bg-gradient-to-r from-maroon-700 via-maroon-800 to-amber-700 dark:from-maroon-900 dark:via-maroon-950 dark:to-gray-900 p-8 text-white text-center relative overflow-hidden">
          {/* Subtle light streak */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-white p-2 shadow-2xl mx-auto mb-3.5 flex items-center justify-center ring-4 ring-white/20 dark:ring-white/10">
              <img
                src="/images/Round_logo.png"
                alt="SabraLeos Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              SabraLeos KPI
            </h1>
            <p className="text-xs text-amber-200/90 font-medium mt-1 tracking-wider uppercase flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-300" />
              Performance & Member Portal
            </p>
          </div>
        </div>

        {/* Main Content Wrapper */}
        <div className="p-7 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs font-semibold animate-shake">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLockedOut || loading}
                  placeholder="your.email@leoclubsusl.lk"
                  className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/80 dark:bg-gray-900/60 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-maroon-500 dark:focus:ring-neon-blue focus:border-transparent outline-none text-sm disabled:opacity-50 transition-all font-medium"
                />
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400 dark:text-gray-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Password
                </label>
                <a
                  href="/#forgot-password"
                  className="text-xs font-semibold text-maroon-600 dark:text-neon-blue hover:underline transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLockedOut || loading}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pl-10 pr-10 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/80 dark:bg-gray-900/60 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-maroon-500 dark:focus:ring-neon-blue focus:border-transparent outline-none text-sm disabled:opacity-50 transition-all font-medium"
                />
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400 dark:text-gray-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLockedOut || loading}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isLockedOut}
              className="w-full py-3.5 px-4 bg-maroon-600 hover:bg-maroon-700 text-white font-bold tracking-wider uppercase rounded-xl transition-all shadow-lg shadow-maroon-600/25 hover:shadow-maroon-600/40 disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing In...
                </>
              ) : isLockedOut ? (
                `Locked (${lockoutRemaining}s)`
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Sign In to Portal
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-gray-200/80 dark:border-white/10 text-center">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
              Leo Club of Sabaragamuwa University of Sri Lanka
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
