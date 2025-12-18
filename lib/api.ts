import { supabase, hasValidSupabaseConfig } from './supabase';
import { fetchDashboardData } from '../services/airtableService';

const USE_MOCK = !hasValidSupabaseConfig();

async function getAuthHeader() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { 'Authorization': `Bearer ${session.access_token}` } : {};
  } catch (e) {
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
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
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
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
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
    return res.json();
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
            daily: data.metrics.funnelData.map((f, i) => ({
                date: new Date(Date.now() - (i * 86400000)).toISOString().split('T')[0],
                total: f.count
            }))
        };
    }
    const headers = await getAuthHeader();
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/.netlify/functions/analytics?${query}`, { headers });
    return res.json();
  }
};