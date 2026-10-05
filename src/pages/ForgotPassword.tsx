import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/#auth/set-password`;
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: redirectUrl,
      });
    } catch (err) {
      console.warn('Password reset request error (suppressed for uniform security response):', err);
    } finally {
      // Fail closed / uniform response: never reveal whether account exists
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-maroon-600 to-maroon-800 p-6 text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-3 shadow-md">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Forgot Password</h2>
          <p className="text-xs text-maroon-100 mt-1">Receive a secure password recovery link</p>
        </div>

        <div className="p-6 space-y-5">
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Check Your Inbox</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                If an account is associated with <strong>{email}</strong>, a secure password reset link has been dispatched. Please check your inbox and spam folders.
              </p>
              <div className="pt-2">
                <a
                  href="/"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-maroon-600 dark:text-neon-blue hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Account Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your registered email"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 px-4 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-maroon-600/20 flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending Reset Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center pt-2">
                <a
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-maroon-600 dark:hover:text-neon-blue"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
