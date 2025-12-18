import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

export const hasValidSupabaseConfig = () => {
    try {
        const meta = import.meta as any;
        const url = meta.env?.VITE_SUPABASE_URL;
        const key = meta.env?.VITE_SUPABASE_ANON_KEY;
        return !!url && !!key && url !== 'undefined' && key !== 'undefined' && !url.includes('placeholder');
    } catch (e) {
        return false;
    }
};

const meta = import.meta as any;
const supabaseUrl = meta.env?.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = meta.env?.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);