import { supabase } from './supabase';
import { UserMeResponse, PreScreenRecord, AnalyticsResponse, ClinicData } from '../types';
import { fetchDashboardData } from '../services/airtableService';

// ✅ IMPORTANT: Mock should NEVER be true in production by default.
// If you want mock locally, set VITE_USE_MOCK=true in your local .env only.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getTokenFallback() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

async function requireToken(explicitToken?: string) {
  const token = explicitToken ?? (await getTokenFallback());
  if (!token) {
    throw new Error('No access token available yet (session not hydrated).');
  }
  return token;
}

export const api = {
  async getMe(token?: string): Promise<UserMeResponse> {
    if (USE_MOCK) {
      return {
        user: { id: "demo_user_123", email: "demo@clinic.com" },
        clinic: {
          id: "rec_uanco_pilot_alpha_89s7d",
          name: "Lerae Medical Aesthetics",
          active: true,
          enabled_features: ["overview", "prescreens", "ai-insight", "compliance", "feedback"],
        },
      };
    }

    const t = await requireToken(token);
    const res = await fetch('/.netlify/functions/me', { headers: authHeaders(t) });

    const text = await res.text();
    if (!res.ok) throw new Error(`GET /me failed (${res.status}): ${text}`);
    return JSON.parse(text);
  },

  async getFullDashboardData(clinicId: string, token?: string): Promise<ClinicData> {
    if (USE_MOCK) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      return fetchDashboardData({ start, end }, clinicId);
    }

    const t = await requireToken(token);
    const res = await fetch(`/.netlify/functions/dashboard?clinicId=${encodeURIComponent(clinicId)}`, {
      headers: authHeaders(t),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`GET /dashboard failed (${res.status}): ${text}`);
    return JSON.parse(text);
  },

  async getPrescreens(params: { limit?: number; since?: string; clinicId?: string } = {}, token?: string): Promise<{ rows: PreScreenRecord[] }> {
    if (USE_MOCK) {
      const data = await this.getFullDashboardData(params.clinicId || "rec_uanco_pilot_alpha_89s7d");
      let rows = data.preScreens;
      if (params.limit) rows = rows.slice(0, params.limit);
      return { rows };
    }

    const t = await requireToken(token);
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/.netlify/functions/prescreens?${query}`, { headers: authHeaders(t) });

    const text = await res.text();
    if (!res.ok) throw new Error(`GET /prescreens failed (${res.status}): ${text}`);
    return JSON.parse(text);
  },

  async getAnalytics(params: { range?: "7d" | "30d" | "90d"; clinicId?: string } = {}, token?: string): Promise<AnalyticsResponse> {
    if (USE_MOCK) {
      const data = await this.getFullDashboardData(params.clinicId || "rec_uanco_pilot_alpha_89s7d");
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
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/.netlify/functions/analytics?${query}`, { headers: authHeaders(t) });

    const text = await res.text();
    if (!res.ok) throw new Error(`GET /analytics failed (${res.status}): ${text}`);
    return JSON.parse(text);
  },
};