import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { AppUser } from '../types/database';
import { userService } from '../services/user-service';
import { logService } from '../services/log-service';
import type { User } from '@supabase/supabase-js';

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // One-time migration: Clear old persistent localStorage sessions
  // to enforce the new sessionStorage-only policy immediately.
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to clear old session data:', e);
    }
  }, []);

  const loadUser = async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        try {
          const userData = await userService.getCurrentUser();
          setAppUser(userData);
        } catch (err) {
          console.error('Error loading app user details:', err);
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
  };

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      (async () => {
        await loadUser();
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const userData = await userService.getCurrentUser();
      await logService.log({
        user_id: authUser.id,
        user_name: userData?.username || authUser.email,
        action: 'LOGIN',
        details: { method: 'password' }
      });
    }

    await loadUser();
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setAppUser(null);
  };

  const refreshUser = async () => {
    await loadUser();
  };

  // --- Session idle timeout ---
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (user) {
      idleTimerRef.current = setTimeout(() => {
        signOut();
      }, SESSION_TIMEOUT_MS);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer));
    resetIdleTimer(); // start timer on mount

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
