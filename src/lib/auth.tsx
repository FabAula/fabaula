import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthCtx {
  session: Session | null;
  email: string;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);

function redirectUrl() {
  return window.location.origin + window.location.pathname;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      // neteja el ?code=... de la URL després del login
      if (window.location.search.includes('code=')) {
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    session,
    email: (session?.user.email ?? '').toLowerCase(),
    loading,
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl(), queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
    },
    async signInWithEmail(email) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true },
      });
      if (error) throw error;
    },
    async signOut() {
      await supabase.auth.signOut();
      localStorage.removeItem('fabaula.school');
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
