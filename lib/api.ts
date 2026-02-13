import { supabase } from './supabase';
import { UserMeResponse, PreScreenRecord, AnalyticsResponse, ClinicData } from '../types';
import { fetchDashboardData } from '../services/airtableService';

// ✅ IMPORTANT: Mock should NEVER be true in production by default.
// If you want mock locally, set VITE_USE_MOCK=true in your local .env only.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// Cache clinic id so we don't keep calling /me when callers forget to pass clinicId

let cachedClinicId: string | null = null;
export type ClinicSwitcherOption = {
  name: string;
  airtable_clinic_record_id: string;
  public_clinic_key: string | null;
};

function getClinicIdFromUrl(): string | null {
  // Allow manual override via URL for admin testing/switching
  // Supports common variants to avoid breaking existing links
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  return (
    sp.get('clinicid') ||
    sp.get('clinicId') ||
    sp.get('clinic_id') ||
    sp.get('clinic')
  );
}

async function resolveClinicId(passedClinicId: string | undefined, token?: string): Promise<string> {
  if (passedClinicId && passedClinicId.trim()) return passedClinicId;

  const urlClinicId = getClinicIdFromUrl();
  if (urlClinicId && urlClinicId.trim()) return urlClinicId;
  if (cachedClinicId) return cachedClinicId;

  // As a safe fallback, fetch the active clinic from /me
  const t = await requireToken(token);
  const res = await fetch('/.netlify/functions/me', { headers: authHeaders(t) });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET /me failed while resolving clinicId (${res.status}): ${text}`);

  const me = JSON.parse(text) as UserMeResponse;
  cachedClinicId = me?.clinic?.id ?? null;
  if (!cachedClinicId) throw new Error('Unable to resolve clinicId (missing clinic in /me response).');
  return cachedClinicId;
}

function authHeaders(token?: string) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      }
    : { Accept: 'application/json' };
}

async function getTokenFallback() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token;
}

async function requireToken(explicitToken?: string) {
  const token = explicitToken ?? (await getTokenFallback());
  if (!token) throw new Error('No access token available yet (session not hydrated).');
  return token;
}

export const api = {
  setActiveClinicId(clinicId: string | null) {
    const trimmed = clinicId?.trim();
    cachedClinicId = trimmed ? trimmed : null;
  },

  async getMe(token?: string): Promise<UserMeResponse> {
    if (USE_MOCK) {
      return {
        user: { id: 'demo_user_123', email: 'demo@clinic.com' },
        clinic: {
          id: 'rec_uanco_pilot_alpha_89s7d',
          name: 'Lerae Medical Aesthetics',
          active: true,
          enabled_features: ['overview', 'prescreens', 'ai-insight', 'compliance', 'feedback'],
        },
      };
    }

    const t = await requireToken(token);
    const res = await fetch('/.netlify/functions/me', { headers: authHeaders(t) });

    const text = await res.text();
    if (!res.ok) throw new Error(`GET /me failed (${res.status}): ${text}`);
    const parsed = JSON.parse(text) as UserMeResponse;
    // keep clinic id cached for other endpoints
    cachedClinicId = parsed?.clinic?.id ?? cachedClinicId;
    return parsed;
  },

  async getFullDashboardData(clinicId: string, token?: string): Promise<ClinicData> {
    if (USE_MOCK) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      return fetchDashboardData({ start, end }, clinicId);
    }

    const t = await requireToken(token);
    const clinicIdToUse = await resolveClinicId(clinicId, t);

    const res = await fetch(
      `/.netlify/functions/dashboard?clinicId=${encodeURIComponent(clinicIdToUse)}`,
      {
        headers: authHeaders(t),
      }
    );

    const text = await res.text();
    if (!res.ok) throw new Error(`GET /dashboard failed (${res.status}): ${text}`);
    return JSON.parse(text);
  },

  async getClinics(token?: string): Promise<{ clinics: ClinicSwitcherOption[] }> {
    if (USE_MOCK) {
      return {
        clinics: [
          {
            name: 'Lerae Medical Aesthetics',
            airtable_clinic_record_id: 'rec_uanco_pilot_alpha_89s7d',
            public_clinic_key: 'demo',
          },
        ],
      };
    }

    const t = await requireToken(token);
    const res = await fetch('/.netlify/functions/clinics', { headers: authHeaders(t) });
    const text = await res.text();
    if (!res.ok) {
      let err = text;
      try {
        const parsed = JSON.parse(text);
        err = parsed?.error || err;
      } catch {
        // keep raw text
      }
      throw new Error(`GET /clinics failed (${res.status}): ${err}`);
    }
    return JSON.parse(text);
  },

  async getPrescreens(
    params: { limit?: number; since?: string; clinicId?: string } = {},
    token?: string
  ): Promise<{ rows: PreScreenRecord[] }> {
    if (USE_MOCK) {
      const data = await api.getFullDashboardData(params.clinicId || 'rec_uanco_pilot_alpha_89s7d');
      let rows = data.preScreens as any;
      if (params.limit) rows = rows.slice(0, params.limit);
      return { rows };
    }

    const t = await requireToken(token);
    const clinicId = await resolveClinicId(params.clinicId, t);
    const query = new URLSearchParams({ ...params, clinicId } as any).toString();
    const res = await fetch(`/.netlify/functions/prescreens?${query}`, { headers: authHeaders(t) });

    const text = await res.text();
    if (!res.ok) throw new Error(`GET /prescreens failed (${res.status}): ${text}`);
    return JSON.parse(text);
  },

  async getAnalytics(
    params: { range?: '7d' | '30d' | '90d'; clinicId?: string } = {},
    token?: string
  ): Promise<AnalyticsResponse> {
    if (USE_MOCK) {
      const data = await api.getFullDashboardData(params.clinicId || 'rec_uanco_pilot_alpha_89s7d');
      return {
        totals: {
          total: data.metrics.totalPreScreens,
          pass: Math.round(data.metrics.totalPreScreens * (data.metrics.passRate / 100)),
          fail: data.metrics.hardFails,
          review: data.metrics.tempFails,
          dropoffs: Math.round(data.metrics.totalPreScreens * (data.metrics.dropOffRate / 100)),
        },
        daily: data.metrics.funnelData.map((f, i) => ({
          date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
          total: f.count,
        })),
      };
    }

    const t = await requireToken(token);
    const clinicId = await resolveClinicId(params.clinicId, t);
    const query = new URLSearchParams({ ...params, clinicId } as any).toString();
    const res = await fetch(`/.netlify/functions/analytics?${query}`, { headers: authHeaders(t) });

    const text = await res.text();
    if (!res.ok) throw new Error(`GET /analytics failed (${res.status}): ${text}`);
    return JSON.parse(text);
  },

  async updatePreScreen(
    id: string,
    updates: Record<string, any>, // allows booking_status now, eligibility later
    token?: string
  ): Promise<any> {
    if (USE_MOCK) return { ok: true };

    const t = await requireToken(token);

    const res = await fetch(`/.netlify/functions/prescreen_update`, {
      method: 'POST',
      headers: {
        ...authHeaders(t),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, updates }),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`POST /prescreen_update failed (${res.status}): ${text}`);
    return JSON.parse(text);
  },
};
