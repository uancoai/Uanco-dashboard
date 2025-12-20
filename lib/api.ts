import { supabase } from './supabase';
import { fetchDashboardData } from '../services/airtableService';

const USE_MOCK = false;

function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getTokenFallback() {
  // fallback only (we prefer passing token from App state)
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

export const api = {
  async getMe(token?: string) {
    if (USE_MOCK) {
      return {
        user: { id: "demo_user_123", email: "demo@uanco.co.uk" },
        clinic: {
          id: "rec_uanco_pilot_alpha_89s7d",
          name: "Lerae Medical Aesthetics",
          active: true,
          enabled_features: ["overview", "prescreens", "ai-insight", "compliance", "feedback"]
        }
      };
    }

    const t = token || await getTokenFallback();
    const res = await fetch('/.netlify/functions/me', { headers: authHeaders(t) });
    if (!res.ok) throw new Error(`GET /me failed (${res.status})`);
    return res.json();
  },

  async getFullDashboardData(clinicId: string, token?: string) {
    if (USE_MOCK) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      return fetchDashboardData({ start, end }, clinicId);
    }

    const t = token || await getTokenFallback();
    const res = await fetch(`/.netlify/functions/dashboard?clinicId=${clinicId}`, { headers: authHeaders(t) });
    if (!res.ok) throw new Error(`GET /dashboard failed (${res.status})`);
    return res.json();
  },

  async getPrescreens(params: { clinicId?: string; limit?: number } = {}, token?: string) {
    if (USE_MOCK) {
      const data = await this.getFullDashboardData(params.clinicId || "rec_uanco_pilot_alpha_89s7d", token);
      let rows = data.preScreens;
      if (params.limit) rows = rows.slice(0, params.limit);
      return { rows };
    }

    const t = token || await getTokenFallback();
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/.netlify/functions/prescreens?${query}`, { headers: authHeaders(t) });
    if (!res.ok) throw new Error(`GET /prescreens failed (${res.status})`);
    return res.json();
  },

  async getAnalytics(params: { clinicId?: string; range?: string } = {}, token?: string) {
    if (USE_MOCK) {
      const data = await this.getFullDashboardData(params.clinicId || "rec_uanco_pilot_alpha_89s7d", token);
      return {
        totals: {
          total: data.metrics.totalPreScreens,
          pass: Math.round(data.metrics.totalPreScreens * (data.metrics.passRate / 100)),
          fail: data.metrics.hardFails,
          review: data.metrics.tempFails,
          dropoffs: Math.round(data.metrics.totalPreScreens * (data.metrics.dropOffRate / 100))
        },
        daily: data.metrics.funnelData.map((f: any, i: number) => ({
          date: new Date(Date.now() - (i * 86400000)).toISOString().split('T')[0],
          total: f.count
        }))
      };
    }

    const t = token || await getTokenFallback();
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/.netlify/functions/analytics?${query}`, { headers: authHeaders(t) });
    if (!res.ok) throw new Error(`GET /analytics failed (${res.status})`);
    return res.json();
  }
};