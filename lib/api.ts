import { supabase } from './supabase';
import { fetchDashboardData } from '../services/airtableService';

// Production: keep false
const USE_MOCK = false;

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  } catch {
    return {};
  }
}

async function fetchJson(url: string) {
  const headers = await getAuthHeader();

  const res = await fetch(url, { headers });

  // helpful error detail for debugging
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {}
    throw new Error(`Request failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
  }

  return res.json();
}

export const api = {
  async getMe() {
    if (USE_MOCK) {
      return {
        user: { id: 'demo_user_123', email: 'demo@uanco.co.uk' },
        clinic: {
          id: 'rec_uanco_pilot_alpha_89s7d',
          name: 'Lerae Medical Aesthetics',
          active: true,
          enabled_features: ['overview', 'prescreens', 'ai-insight', 'compliance', 'feedback'],
        },
      };
    }

    // ✅ MUST include Bearer token
    return fetchJson('/.netlify/functions/me');
  },

  async getFullDashboardData(clinicId?: string) {
    if (USE_MOCK) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      return fetchDashboardData({ start, end }, clinicId || 'rec_uanco_pilot_alpha_89s7d');
    }

    // ✅ Do NOT accept clinicId from client
    // Backend should derive clinic scope from the Bearer token
    return fetchJson('/.netlify/functions/dashboard');
  },

  async getPrescreens(params: { limit?: number; since?: string } = {}) {
    if (USE_MOCK) {
      const data = await this.getFullDashboardData('rec_uanco_pilot_alpha_89s7d');
      let rows = data.preScreens;
      if (params.limit) rows = rows.slice(0, params.limit);
      return { rows };
    }

    // ✅ Only allow non-sensitive params (limit/since), not clinicId
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.since) query.set('since', params.since);

    const qs = query.toString();
    return fetchJson(`/.netlify/functions/prescreens${qs ? `?${qs}` : ''}`);
  },

  async getAnalytics(params: { range?: string } = {}) {
    if (USE_MOCK) {
      const data = await this.getFullDashboardData('rec_uanco_pilot_alpha_89s7d');
      return {
        totals: {
          total: data.metrics.totalPreScreens,
          pass: Math.round(data.metrics.totalPreScreens * (data.metrics.passRate / 100)),
          fail: data.metrics.hardFails,
          review: data.metrics.tempFails,
          dropoffs: Math.round(data.metrics.totalPreScreens * (data.metrics.dropOffRate / 100)),
        },
        daily: data.metrics.funnelData.map((f: any, i: number) => ({
          date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
          total: f.count,
        })),
      };
    }

    // ✅ Only allow range param (7d|30d|90d etc). No clinicId.
    const query = new URLSearchParams();
    if (params.range) query.set('range', params.range);

    const qs = query.toString();
    return fetchJson(`/.netlify/functions/analytics${qs ? `?${qs}` : ''}`);
  },
};