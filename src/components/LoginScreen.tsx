import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logService } from '../services/log-service';
import { LogIn, Loader2, Eye, EyeOff, ShieldAlert, Lock, Mail } from 'lucide-react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (isLockedOut) return;
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      setFailedAttempts(0);
      logService.logLogin();
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
        // Uniform error response
        setError(`Invalid email or password. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-maroon-950 to-gray-900">
      {/* Floating Card Container */}
      <div className="w-full max-w-md glass-panel rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col items-center py-8 px-6 border border-white/10 bg-white/5 backdrop-blur-xl">

        {/* Top Title */}
        <div className="w-full text-center z-10 flex-shrink-0 mb-6">
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase font-['Oswald'] drop-shadow-sm">
            SabraLeos KPI
          </h1>
          <p className="text-xs text-amber-200/80 font-medium mt-1 tracking-wider uppercase">
            Performance & Leadership Portal
          </p>
        </div>

        {/* Main Content Wrapper */}
        <div className="w-full flex flex-col items-center justify-center relative z-10">

          {/* Main Logo */}
          <div className="mb-6 relative group flex-shrink-0">
            <div className="w-28 h-28 rounded-full flex items-center justify-center shadow-xl overflow-hidden relative border-2 border-amber-400/40 bg-maroon-900/40 p-2">
              <img
                src="/images/Round_logo.png"
                alt="Leo Club Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {error && (
              <div className="p-3.5 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center gap-2.5 text-red-200 text-xs animate-shake">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLockedOut || loading}
                  placeholder="leo.member@domain.com"
                  className="w-full px-4 py-3 pl-10 border border-white/10 rounded-xl bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-400/80 outline-none text-sm disabled:opacity-50 transition-all"
                />
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Password
                </label>
                <a
                  href="/#auth/forgot-password"
                  className="text-xs text-amber-300 hover:text-amber-200 hover:underline transition-colors"
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
                  className="w-full px-4 py-3 pl-10 pr-10 border border-white/10 rounded-xl bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-400/80 outline-none text-sm disabled:opacity-50 transition-all"
                />
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLockedOut || loading}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isLockedOut}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-maroon-950 font-black tracking-wider uppercase rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing In...
                </>
              ) : isLockedOut ? (
                `Locked (${lockoutRemaining}s)`
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Sign In
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-gray-400 text-center mt-6">
            Leo Club of Sabaragamuwa University of Sri Lanka
          </p>
        </div>
      </div>
    </div>
  );
}
