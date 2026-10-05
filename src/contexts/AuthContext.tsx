import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { AppUser } from '../types/database';
import { userService } from '../services/user-service';
import { logService } from '../services/log-service';
import type { User } from '@supabase/supabase-js';

// Officers: 15-minute idle timeout. Members: 30-minute idle timeout.
const OFFICER_TIMEOUT_MS = 15 * 60 * 1000;
const MEMBER_TIMEOUT_MS  = 30 * 60 * 1000;
const OFFICER_ROLES = new Set(['viewer', 'editor', 'super_admin']);

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Clear old local session tokens on mount
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to clear old session data:', e);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setUser(null);
      setAppUser(null);
    }
  }, []);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        try {
          const sessionCtx = await userService.getSessionContext();

          // Fail closed: No valid role or suspended account -> terminate session immediately
          if (!sessionCtx || !sessionCtx.valid || sessionCtx.status === 'suspended') {
            await supabase.auth.signOut();
            setUser(null);
            setAppUser(null);
            return;
          }

          const userData = await userService.getCurrentUser();
          setAppUser(userData);
        } catch (err) {
          console.error('Error validating session context:', err);
          await supabase.auth.signOut();
          setUser(null);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
      setAppUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAppUser(null);
      } else {
        void loadUser();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUser]);

  const signIn = async (email: string, password: string, captchaToken?: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) {
      // Uniform error message
      throw new Error('Invalid email or password');
    }

    // Check session context
    const sessionCtx = await userService.getSessionContext();
    if (!sessionCtx || !sessionCtx.valid || sessionCtx.status === 'suspended') {
      await supabase.auth.signOut();
      throw new Error('Invalid email or password');
    }

    await loadUser();

    // Log officer login
    try {
      await logService.logLogin();
    } catch {
      // Non-fatal
    }
  };

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  // Session idle timeout — per role
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (user) {
      const role = appUser?.role ?? '';
      const timeout = OFFICER_ROLES.has(role) ? OFFICER_TIMEOUT_MS : MEMBER_TIMEOUT_MS;
      idleTimerRef.current = setTimeout(() => {
        void signOut();
      }, timeout);
    }
  }, [user, appUser?.role, signOut]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer));
    resetIdleTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, resetIdleTimer]);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
