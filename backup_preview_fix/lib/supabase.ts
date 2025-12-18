import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.39.7';

// In modern Vite/ESM environments, use import.meta.env
// Fix: use type assertion to any to bypass strict ImportMeta checks in some environments
const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const hasValidSupabaseConfig = () => {
    try {
        const env = (import.meta as any).env;
        if (!env) return false;
        const url = env.VITE_SUPABASE_URL;
        const key = env.VITE_SUPABASE_ANON_KEY;
        // Ensure keys are present and not the string "undefined"
        return !!url && !!key && url !== 'undefined' && key !== 'undefined';
    } catch (e) {
        return false;
    }
};