import { createContext, useContext, useEffect, useState } from 'react';
import supabase from '../lib/supabase';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    clinic_name: import.meta.env.VITE_APP_NAME || 'Clinic Management',
    default_consultation_fee: 500,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const { data: list, error } = await supabase.from('settings').select('*');
        if (error) throw error;

        const map = {
          clinic_name: import.meta.env.VITE_APP_NAME || 'Clinic Management',
          default_consultation_fee: 500,
        };
        list.forEach(item => {
          if (item.key === 'default_consultation_fee') {
            map[item.key] = parseFloat(item.value) || 500;
          } else {
            map[item.key] = item.value;
          }
        });
        setSettings(map);
      } catch (err) {
        console.error('Failed to load settings from DB:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
