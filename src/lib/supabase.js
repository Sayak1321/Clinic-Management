import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

if (!supabaseUrl || !isValidUrl(supabaseUrl)) {
  console.warn('[supabase] WARNING: VITE_SUPABASE_URL is missing or invalid ("' + supabaseUrl + '"). Please configure it in your .env.local file. Using placeholder to prevent application crash.');
  supabaseUrl = 'https://placeholder-project.supabase.co';
}

const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder-key');

export default supabase;
