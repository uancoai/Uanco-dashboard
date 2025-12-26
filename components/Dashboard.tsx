import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import KPICard from './KPICard';
import { Loader2, ArrowRight } from 'lucide-react';

type Props = {
  clinicId?: string;      // Airtable rec... id
  clinicName?: string;    // Pretty name for display
  onNavigate: (view: string) => void;
};

function pickFirst(v: any) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function normEligibility(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'pass') return 'Pass';
  if (s === 'fail') return 'Fail';
  if (s === 'review') return 'Review';
  return v ? String(v) : '';
}

function getTimestamp(r: any) {
  // prefer webhook timestamp if present (you mentioned it), fall back to created-like fields
  const candidates = [
    r?.webhook_timestamp,
    r?.Webhook_Timestamp,
    r?.created_at,
    r?.Created,
    r?.CreatedAt,
    r?.submitted_at,
    r?.SubmittedAt,
  ];
  const raw = candidates.find((x) => x !== undefined && x !== null && String(x).trim() !== '');
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
}

const Dashboard: React.FC<Props> = ({ clinicId, clinicName, onNavigate }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErr(null);

      try {
        if (!clinicId) throw new Error('Missing clinicId');

        // 1) analytics KPIs
        const a = await api.getAnalytics({ range: '30d', clinicId });

        // 2) full dashboard payload for "recent activity" snapshot
        const d = await api.getFullDashboardData(clinicId);

        if (!cancelled) {
          setAnalytics(a);
          setDash(d);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load overview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  const totals = analytics?.totals || { total: 0, pass: 0, review: 0, dropoffs: 0 };

  const recent = useMemo(() => {
    const rows = (dash?.preScreens || []).slice();

    rows.sort((a: any, b: any) => getTimestamp(b) - getTimestamp(a));

    return rows.slice(0, 6).map((r: any) => {
      const name =
        r?.Name ??
        r?.name ??
        r?.Patient ??
        r?.patient_name ??
        pickFirst(r?.Patient) ??
        '—';

      const treatment =
        r?.interested_treatments ??
        r?.treatment_selected ??
        r?.Treatment ??
        r?.treatment ??
        pickFirst(r?.Treatments) ??
        '—';

      const eligibility = normEligibility(r?.eligibility ?? r?.Eligibility);

      return {
        id: r?.id,
        name: String(name).trim(),
        treatment: String(treatment).trim(),
        eligibility,
      };
    });
  }, [dash]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="animate-spin text-uanco-300" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="bg-white rounded-3xl p-8 border shadow-soft">
        <p className="text-sm text-rose-600 font-medium">Dashboard overview failed</p>
        <p className="text-xs text-uanco-500 mt-2 break-words">{err}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="text-3xl font-serif">Overview</h2>
        <span className="text-xs font-bold text-uanco-400 uppercase tracking-widest">
          {clinicName || clinicId || 'Clinic'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Prescreens" value={totals.total} variant="dark" />
        <KPICard title="Safe to Book" value={totals.pass} trend="Healthy" />
        <KPICard title="Manual Review" value={totals.review} subValue="Attention" />
        <KPICard title="Drop-offs" value={totals.dropoffs} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 border shadow-soft">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium">Recent Prescreens</h3>
            <button
              onClick={() => onNavigate('prescreens')}
              className="text-xs font-bold text-uanco-400 flex items-center gap-1 hover:text-uanco-900"
            >
              View Details <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl border border-uanco-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-uanco-500 truncate">{r.treatment}</p>
                </div>

                <span
                  className={[
                    'shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full border',
                    r.eligibility.toLowerCase() === 'pass'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : r.eligibility.toLowerCase() === 'review'
                      ? 'bg-amber-50 text-amber-800 border-amber-100'
                      : r.eligibility.toLowerCase() === 'fail'
                      ? 'bg-rose-50 text-rose-700 border-rose-100'
                      : 'bg-uanco-50 text-uanco-700 border-uanco-100',
                  ].join(' ')}
                >
                  {r.eligibility || '—'}
                </span>
              </div>
            ))}

            {recent.length === 0 && (
              <p className="text-sm text-uanco-500">No recent prescreens found for this clinic.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border shadow-soft">
          <h3 className="text-lg font-medium mb-4">Performance</h3>
          <p className="text-sm text-uanco-500">
            System is processing patient eligibility correctly based on clinic protocols.
          </p>

          <div className="mt-6 space-y-2 text-xs text-uanco-500">
            <div className="flex justify-between">
              <span>Pass rate</span>
              <span className="font-bold text-uanco-900">{dash?.metrics?.passRate ?? 0}%</span>
            </div>
            <div className="flex justify-between">
              <span>Drop-off rate</span>
              <span className="font-bold text-uanco-900">{dash?.metrics?.dropOffRate ?? 0}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;