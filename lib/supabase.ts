import { createClient } from '@supabase/supabase-js';

// Access environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debugging: Log status to console (Don't log the full key for security)
const isConfigured = supabaseUrl && supabaseAnonKey;
console.log(
  `%c[Supabase Config] %c${isConfigured ? 'OK' : 'MISSING'}`, 
  'font-weight: bold; color: #8CD9E8', 
  isConfigured ? 'color: #4ade80' : 'color: #ef4444'
);

if (!isConfigured) {
  console.warn('Supabase environment variables are missing. Check Netlify Environment Variables.');
}

// Create the client with a fallback to avoid crashing, but auth won't work if keys are missing
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Helper to check config validity in UI components
export const hasValidSupabaseConfig = () => {
  return (
    !!supabaseUrl && 
    !!supabaseAnonKey && 
    supabaseUrl !== 'undefined' && 
    supabaseAnonKey !== 'undefined' &&
    supabaseUrl.includes('supabase.co') // Basic validation
  );
};