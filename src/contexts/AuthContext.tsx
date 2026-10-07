import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { AppUser } from '../types/database';
import { userService } from '../services/user-service';
import { logService } from '../services/log-service';
import { systemService } from '../services/system-service';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

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

  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(async () => {
    try {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (user) {
        void logService.logSecurityEvent('LOGOUT', { user_id: user.id, username: appUser?.username }, user.id);
      }
      systemService.clearStaticCache();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      systemService.clearStaticCache();
      lastUserIdRef.current = null;
      setUser(null);
      setAppUser(null);
      setLoading(false);
    }
  }, [user, appUser]);

  const loadUserContext = useCallback(async (targetUser: User | null, forceReload = false) => {
    if (!targetUser) {
      lastUserIdRef.current = null;
      setUser(null);
      setAppUser(null);
      setLoading(false);
      return;
    }

    // Check if same user is already loaded and not force-reloading
    if (!forceReload && lastUserIdRef.current === targetUser.id && appUser) {
      setUser(targetUser);
      setLoading(false);
      return;
    }

    // Reuse in-flight promise if already loading for the same user
    if (inFlightPromiseRef.current && !forceReload && lastUserIdRef.current === targetUser.id) {
      return inFlightPromiseRef.current;
    }

    const task = (async () => {
      try {
        const sessionCtx = await userService.getSessionContext();

        // Fail closed: No valid role or suspended account -> terminate session immediately
        if (!sessionCtx || !sessionCtx.valid || sessionCtx.status === 'suspended') {
          console.warn('Session context invalid or suspended. Terminating session.');
          lastUserIdRef.current = null;
          setUser(null);
          setAppUser(null);
          try {
            await supabase.auth.signOut();
          } catch {
            // non-fatal
          }
          return;
        }

        const userProfile: AppUser = {
          id: sessionCtx.id ?? targetUser.id,
          username: sessionCtx.username ?? targetUser.email?.split('@')[0] ?? 'user',
          designation: sessionCtx.designation ?? 'Member',
          role: sessionCtx.role ?? 'member',
          status: sessionCtx.status ?? 'active',
          linked_member_reg_no: sessionCtx.linked_member_reg_no ?? null,
          created_at: sessionCtx.created_at ?? new Date().toISOString(),
        };

        lastUserIdRef.current = targetUser.id;
        setUser(targetUser);
        setAppUser(userProfile);
      } catch (err) {
        console.error('Error validating session context:', err);
        lastUserIdRef.current = null;
        setUser(null);
        setAppUser(null);
        try {
          await supabase.auth.signOut();
        } catch {
          // non-fatal
        }
      } finally {
        inFlightPromiseRef.current = null;
        setLoading(false);
      }
    })();

    inFlightPromiseRef.current = task;
    return task;
  }, [appUser]);

  // Single entry point: onAuthStateChange handles INITIAL_SESSION and subsequent events
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        lastUserIdRef.current = null;
        setUser(null);
        setAppUser(null);
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        // Same user token refresh - update user object without re-fetching profile
        if (session.user && lastUserIdRef.current === session.user.id) {
          setUser(session.user);
          return;
        }
      }

      // Defer execution outside the auth callback stack to prevent deadlock
      setTimeout(() => {
        void loadUserContext(session.user);
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUserContext]);

  const signIn = async (email: string, password: string, captchaToken?: string): Promise<void> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error || !data.user) {
      throw new Error('Invalid email or password');
    }

    // Validate session context immediately
    const sessionCtx = await userService.getSessionContext();
    if (!sessionCtx || !sessionCtx.valid || sessionCtx.status === 'suspended') {
      await supabase.auth.signOut();
      throw new Error('Invalid email or password');
    }

    const userProfile: AppUser = {
      id: sessionCtx.id ?? data.user.id,
      username: sessionCtx.username ?? data.user.email?.split('@')[0] ?? 'user',
      designation: sessionCtx.designation ?? 'Member',
      role: sessionCtx.role ?? 'member',
      status: sessionCtx.status ?? 'active',
      linked_member_reg_no: sessionCtx.linked_member_reg_no ?? null,
      created_at: sessionCtx.created_at ?? new Date().toISOString(),
    };

    lastUserIdRef.current = data.user.id;
    setUser(data.user);
    setAppUser(userProfile);
    setLoading(false);

    // Log officer login non-fatally
    try {
      await logService.logLogin();
    } catch {
      // Non-fatal
    }
  };

  const refreshUser = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    await loadUserContext(currentUser, true);
  }, [loadUserContext]);

  // Session idle timeout — per role
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
