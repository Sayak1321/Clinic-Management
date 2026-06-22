import { createContext, useContext, useEffect, useState } from 'react';
import supabase from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch user profile by ID and merge with auth metadata
  const fetchProfile = async (sessionUser) => {
    if (!sessionUser) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();
      
      if (error) {
        console.error('[auth] Error fetching profile:', error);
        // Fallback to basic session user if profile not found
        return {
          id: sessionUser.id,
          email: sessionUser.email,
          name: sessionUser.user_metadata?.name || 'Unknown User',
          role: sessionUser.user_metadata?.role || 'receptionist',
          is_available: true,
        };
      }
      return {
        id: sessionUser.id,
        email: sessionUser.email,
        ...data,
      };
    } catch (err) {
      console.error('[auth] Failed to fetch profile details:', err);
      return {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.user_metadata?.name || 'Unknown User',
        role: sessionUser.user_metadata?.role || 'receptionist',
        is_available: true,
      };
    }
  };

  useEffect(() => {
    // 1. Check current session
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchProfile(session.user);
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('[auth] Session initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[auth] Event:', event);
      if (session?.user) {
        const profile = await fetchProfile(session.user);
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const profile = await fetchProfile(data.user);
    setUser(profile);
    return profile;
  };

  const register = async ({ name, email, password, role }) => {
    const normRole = (role || 'receptionist').toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: normRole,
        }
      }
    });
    if (error) throw error;
    if (!data.user) throw new Error('Registration failed.');

    // Wait briefly for the PostgreSQL trigger to execute and create the profile
    await new Promise(resolve => setTimeout(resolve, 500));
    const profile = await fetchProfile(data.user);
    setUser(profile);
    return profile;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('[auth] Sign out error:', error);
    setUser(null);
  };

  const getDashboardPath = (u) => {
    const r = (u?.role ?? '').toLowerCase();
    if (r === 'doctor')      return '/doctor';
    if (r === 'admin')       return '/admin';
    return '/receptionist';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, getDashboardPath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
