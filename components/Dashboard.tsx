import React, { useMemo, useState } from 'react';
import KPICard from './KPICard';
import DrillDownPanel from './DrillDownPanel';
import { ArrowRight } from 'lucide-react';

type Props = {
  clinicId?: string;
  clinicName?: string;
  onNavigate: (view: string) => void;

  // ✅ live dashboard payload pieces (from /.netlify/functions/dashboard)
  preScreens?: any[];
  dropOffs?: any[];
  questions?: any[];
  metrics?: any;
};

function normElig(v: any) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'pass') return 'Pass';
  if (s === 'fail') return 'Fail';
  if (s === 'review') return 'Review';
  return v ? String(v) : '—';
}

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

function parseDateMaybe(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatShortDate(d: Date | null) {
  if (!d) return '';
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const Dashboard: React.FC<Props> = ({
  clinicId,
  clinicName,
  onNavigate,
  preScreens = [],
  questions = [],
  metrics = {},
}) => {
  const [selected, setSelected] = useState<any | null>(null);

  const totals = useMemo(() => {
    // Prefer computed metrics from backend, but fall back safely
    const total = Number(metrics?.totalPreScreens ?? preScreens.length ?? 0);
    const passRate = Number(metrics?.passRate ?? 0);
    const tempFails = Number(metrics?.tempFails ?? 0);
    const hardFails = Number(metrics?.hardFails ?? 0);
    const dropOffRate = Number(metrics?.dropOffRate ?? 0);

    const pass = Math.round(total * (passRate / 100));
    const dropoffs = Math.round(total * (dropOffRate / 100));
    const review = tempFails; // review bucket

    return { total, pass, review, dropoffs, hardFails };
  }, [metrics, preScreens.length]);

  const recent = useMemo(() => {
    // Sort by best-known timestamp fields (handles your webhook_timestamp situation)
    const dateKeys = ['webhook_timestamp', 'Webhook Timestamp', 'created_at', 'Created', 'Created Time', 'submitted_at', 'Submitted At'];
    const copy = [...preScreens];

    copy.sort((a, b) => {
      const da = parseDateMaybe(getFirstNonEmpty(a, dateKeys));
      const db = parseDateMaybe(getFirstNonEmpty(b, dateKeys));
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      return tb - ta;
    });

    return copy.slice(0, 8);
  }, [preScreens]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <h2 className="text-3xl font-serif">Overview</h2>
        <span className="text-xs font-bold text-uanco-400 uppercase tracking-widest">
          {clinicName || clinicId || 'Clinic'}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Prescreens" value={totals.total} variant="dark" />
        <KPICard title="Safe to Book" value={totals.pass} trend="Healthy" />
        <KPICard title="Manual Review" value={totals.review} subValue="Attention" />
        <KPICard title="Drop-offs" value={totals.dropoffs} />
      </div>

      {/* Main grid: Recent Activity + Insight panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-3xl border shadow-soft overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b bg-white/60">
            <div>
              <h3 className="text-lg font-medium">Recent Activity</h3>
              <p className="text-[11px] text-uanco-400">Most recent prescreens for this clinic</p>
            </div>
            <button
              onClick={() => onNavigate('prescreens')}
              className="text-xs font-bold text-uanco-400 flex items-center gap-1 hover:text-uanco-900"
            >
              View All <ArrowRight size={14} />
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="p-8 text-sm text-uanco-500">No prescreens found yet.</div>
          ) : (
            <div className="divide-y">
              {recent.map((r: any) => {
                const name = getFirstNonEmpty(r, ['Name', 'name']) || 'Unnamed';
                const email = getFirstNonEmpty(r, ['Email', 'email']) || '';
                const treatment = getFirstNonEmpty(r, ['interested_treatments', 'Interested Treatments', 'treatment_selected', 'Treatment']) || '—';
                const elig = normElig(getFirstNonEmpty(r, ['eligibility', 'Eligibility']));
                const d = parseDateMaybe(getFirstNonEmpty(r, ['webhook_timestamp', 'Webhook Timestamp', 'created_at', 'Created', 'Created Time', 'submitted_at', 'Submitted At']));

                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="w-full text-left px-6 py-4 hover:bg-uanco-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border
                              ${String(elig).toLowerCase() === 'pass'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : String(elig).toLowerCase() === 'review'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-rose-50 text-rose-700 border-rose-100'
                              }`}
                          >
                            {elig}
                          </span>
                        </div>
                        <p className="text-[12px] text-uanco-500 truncate">
                          {email} {email && '•'} {String(treatment)}
                        </p>
                      </div>

                      <div className="text-[11px] text-uanco-400 whitespace-nowrap">
                        {formatShortDate(d)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Insight panel (lightweight, uses existing data without changing design too much yet) */}
        <div className="bg-white rounded-3xl border shadow-soft p-6">
          <h3 className="text-lg font-medium">AI Insight</h3>
          <p className="text-[11px] text-uanco-400 mt-1">Quick snapshot from recent activity</p>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Questions captured</span>
              <span className="text-sm font-medium">{questions.length}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Pass rate</span>
              <span className="text-sm font-medium">{Number(metrics?.passRate ?? 0)}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Drop-off rate</span>
              <span className="text-sm font-medium">{Number(metrics?.dropOffRate ?? 0)}%</span>
            </div>
          </div>

          <div className="mt-6 text-[12px] text-uanco-500">
            Click a patient to view the full pre-screen + AI summary.
          </div>
        </div>
      </div>

      {/* Drilldown */}
      {selected && (
        <DrillDownPanel
          // We pass both names to avoid guessing what DrillDownPanel expects
          record={selected}
          prescreen={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;