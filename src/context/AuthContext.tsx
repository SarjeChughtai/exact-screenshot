import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRoles: string[];
  loading: boolean;
  rolesLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  // Track current user ID via ref so the auth listener always sees the latest value
  const currentUserIdRef = React.useRef<string | null>(null);

  const fetchRoles = async (userId: string) => {
    setRolesLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (!error && data) {
      setUserRoles(data.map((r: any) => r.role));
    } else {
      setUserRoles([]);
    }
    setRolesLoading(false);
  };

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        const incomingUserId = currentSession?.user?.id ?? null;

        // Skip cross-tab auth events that don't represent a real change for this tab.
        // currentUserIdRef always holds the latest value (no stale closure issue).
        if (event !== 'SIGNED_OUT' && incomingUserId && incomingUserId === currentUserIdRef.current) {
          return;
        }

        currentUserIdRef.current = incomingUserId;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          fetchRoles(currentSession.user.id);
        } else {
          setUserRoles([]);
          setRolesLoading(false);
        }
        setLoading(false);
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoles(session.user.id);
      } else {
        setRolesLoading(false);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      setRolesLoading(false);
    });

    return () => {
      subscription.unsubscribe();
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

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRoles([]);
    setRolesLoading(false);
  };

  const hasRole = (role: string) => userRoles.includes(role);
  const hasAnyRole = (roles: string[]) => roles.some(r => userRoles.includes(r));

  return (
    <AuthContext.Provider value={{
      session, user, userRoles, loading, rolesLoading,
      signUp, signIn, signInWithGoogle, signOut, hasRole, hasAnyRole,
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
