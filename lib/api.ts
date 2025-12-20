import { supabase } from './supabase';
import { fetchDashboardData } from '../services/airtableService';

const USE_MOCK = false;

async function getAuthHeader() {
  try {
    // Primary: session (gives access_token)
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (token) {
      return { Authorization: `Bearer ${token}` };
    }

    // Fallback: if user exists but session didn't hydrate yet, still return empty safely
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      // user exists but token missing - still no header, but we won't crash
      return {};
    }

    return {};
  } catch {
    return {};
  }
}

export const api = {
  async getMe() {
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

    const headers = await getAuthHeader();
    const res = await fetch('/.netlify/functions/me', { headers });

    // Bubble up the real reason (helps debugging)
    const text = await res.text();
    if (!res.ok) throw new Error(text || 'Failed to fetch profile');
    return JSON.parse(text);
  },

  async getFullDashboardData(clinicId: string) {
    if (USE_MOCK) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      return fetchDashboardData({ start, end }, clinicId);
    }

    const headers = await getAuthHeader();
    const res = await fetch(`/.netlify/functions/dashboard?clinicId=${clinicId}`, { headers });

    const text = await res.text();
    if (!res.ok) throw new Error(text || 'Failed to fetch data');
    return JSON.parse(text);
  },

  async getPrescreens(params: { clinicId?: string; limit?: number } = {}) {
    if (USE_MOCK) {
      const data = await this.getFullDashboardData(params.clinicId || "rec_uanco_pilot_alpha_89s7d");
      let rows = data.preScreens;
      if (params.limit) rows = rows.slice(0, params.limit);
      return { rows };
    }

    const headers = await getAuthHeader();
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/.netlify/functions/prescreens?${query}`, { headers });

    const text = await res.text();
    if (!res.ok) throw new Error(text || 'Failed to fetch prescreens');
    return JSON.parse(text);
  },

  async getAnalytics(params: { clinicId?: string; range?: string } = {}) {
    if (USE_MOCK) {
      const data = await this.getFullDashboardData(params.clinicId || "rec_uanco_pilot_alpha_89s7d");
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

    const headers = await getAuthHeader();
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/.netlify/functions/analytics?${query}`, { headers });

    const text = await res.text();
    if (!res.ok) throw new Error(text || 'Failed to fetch analytics');
    return JSON.parse(text);
  }
};