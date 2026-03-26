import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRoles: string[];
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isDevMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Dev mode mock session for when Supabase is not available
const DEV_MOCK_USER: User = {
  id: 'dev-user-001',
  email: 'admin@canadasteel.ca',
  app_metadata: {},
  user_metadata: { name: 'Dev Admin' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

const DEV_MOCK_SESSION: Session = {
  access_token: 'dev-token',
  refresh_token: 'dev-refresh',
  expires_in: 999999,
  expires_at: Date.now() / 1000 + 999999,
  token_type: 'bearer',
  user: DEV_MOCK_USER,
} as Session;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDevMode, setIsDevMode] = useState(false);

  const fetchRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (!error && data) {
      setUserRoles(data.map((r: any) => r.role));
    }
  };

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(() => fetchRoles(session.user.id), 0);
        } else {
          setUserRoles([]);
        }
        setLoading(false);
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoles(session.user.id);
      }
      setLoading(false);
    }).catch(() => {
      // If Supabase is unreachable, enable dev mode
      console.warn('[Auth] Supabase unreachable — enabling dev mode');
      setSession(DEV_MOCK_SESSION);
      setUser(DEV_MOCK_USER);
      setUserRoles(['admin']);
      setIsDevMode(true);
      setLoading(false);
    });

    // Safety timeout: if loading takes > 3s, fallback to dev mode
    timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Timed out waiting for Supabase — enabling dev mode');
        setSession(DEV_MOCK_SESSION);
        setUser(DEV_MOCK_USER);
        setUserRoles(['admin']);
        setIsDevMode(true);
        setLoading(false);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    if (isDevMode) {
      // In dev mode, just clear local state
      setSession(null);
      setUser(null);
      setUserRoles([]);
      return;
    }
    await supabase.auth.signOut();
    setUserRoles([]);
  };

  const hasRole = (role: string) => userRoles.includes(role);
  const hasAnyRole = (roles: string[]) => roles.some(r => userRoles.includes(r));

  return (
    <AuthContext.Provider value={{
      session, user, userRoles, loading, isDevMode,
      signUp, signIn, signOut, hasRole, hasAnyRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
