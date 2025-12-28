import React, { useMemo, useState } from 'react';
import KPICard from './KPICard';
import DrillDownPanel from './DrillDownPanel';
import { ArrowRight } from 'lucide-react';

type Props = {
  clinicId?: string;
  clinicName?: string;
  onNavigate: (view: string) => void;

  // live dashboard payload pieces (from /.netlify/functions/dashboard)
  preScreens?: any[];
  dropOffs?: any[];
  questions?: any[];
  metrics?: any;

  // If passed from App.tsx, booking toggle works from Overview drilldown too
  onUpdateRecord?: (id: string, updates: any) => void;
};

function toUiEligibility(raw: any): 'SAFE' | 'REVIEW' | 'UNSUITABLE' | '—' {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pass') return 'SAFE';
  if (s === 'review') return 'REVIEW';
  if (s === 'fail') return 'UNSUITABLE';
  if (s === 'safe') return 'SAFE';
  if (s === 'unsuitable') return 'UNSUITABLE';
  return raw ? (String(raw).toUpperCase() as any) : '—';
}

function badgeClasses(label: string) {
  const s = String(label || '').toLowerCase();
  if (s === 'safe') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'review') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

function toLower(v: any) {
  return String(v || '').trim().toLowerCase();
}

function isManualReview(rec: any) {
  // 1) If eligibility itself is review, easy win
  const elig = toLower(getFirstNonEmpty(rec, ['eligibility', 'Eligibility']));
  if (elig === 'review') return true;

  // 2) Otherwise try common “flag” fields (you can add your exact Airtable field names here)
  const raw = getFirstNonEmpty(rec, [
    'flagged_for_review',
    'Flagged for review',
    'flagged',
    'Flagged',
    'manual_review',
    'Manual Review',
    'screening_status',
    'Screening Status',
    'status',
    'Status',
  ]);

  const s = toLower(raw);

  // Checkbox field in Airtable often arrives as true/false
  if (raw === true) return true;
  if (s === 'true') return true;

  return (
    s === 'review' ||
    s === 'manual review' ||
    s === 'flagged' ||
    s === 'flagged for review' ||
    s === 'needs review' ||
    s === 'attention'
  );
}

function parseDateMaybe(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatShortDate(d: Date | null) {
  if (!d) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const Dashboard: React.FC<Props> = ({
  clinicId,
  clinicName,
  onNavigate,
  preScreens = [],
  questions = [],
  metrics = {},
  onUpdateRecord,
}) => {
  const [selected, setSelected] = useState<any | null>(null);

  const totals = useMemo(() => {
    const total = Number(metrics?.totalPreScreens ?? preScreens.length ?? 0);
    const passRate = Number(metrics?.passRate ?? 0);
    const dropOffRate = Number(metrics?.dropOffRate ?? 0);

    const safeToBook = Math.round(total * (passRate / 100));
    const dropoffs = Math.round(total * (dropOffRate / 100));

    // ✅ Manual Review: use backend if it’s a real number, otherwise fallback to counting records
    const backendTempFails = metrics?.tempFails;
    const review =
      typeof backendTempFails === 'number' && Number.isFinite(backendTempFails)
        ? backendTempFails
        : preScreens.filter(isManualReview).length;

    const booked = preScreens.filter((r: any) => {
      const raw = getFirstNonEmpty(r, ['booking_status', 'Booking Status', 'booked', 'Booked']);
      return String(raw || '').trim().toLowerCase() === 'booked';
    }).length;

    return { total, safeToBook, review, dropoffs, booked };
  }, [metrics, preScreens]);

  const recent = useMemo(() => {
    const dateKeys = [
      'webhook_timestamp',
      'Webhook Timestamp',
      'created_at',
      'Created',
      'Created Time',
      'submitted_at',
      'Submitted At',
    ];

    const copy = [...preScreens];
    copy.sort((a, b) => {
      const da = parseDateMaybe(getFirstNonEmpty(a, dateKeys));
      const db = parseDateMaybe(getFirstNonEmpty(b, dateKeys));
      return (db?.getTime() || 0) - (da?.getTime() || 0);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Total Prescreens" value={totals.total} variant="dark" />
        <KPICard title="Safe to Book" value={totals.safeToBook} />
        <KPICard title="Manual Review" value={totals.review} />
        <KPICard title="Drop-offs" value={totals.dropoffs} />
        <KPICard title="Booked" value={totals.booked} />
      </div>

      {/* Main grid */}
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
                const treatment =
                  getFirstNonEmpty(r, [
                    'interested_treatments',
                    'Interested Treatments',
                    'treatment_selected',
                    'Treatment',
                  ]) || '—';

                const eligUi = toUiEligibility(getFirstNonEmpty(r, ['eligibility', 'Eligibility']));
                const d = parseDateMaybe(
                  getFirstNonEmpty(r, [
                    'webhook_timestamp',
                    'Webhook Timestamp',
                    'created_at',
                    'Created',
                    'Created Time',
                    'submitted_at',
                    'Submitted At',
                  ])
                );

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
                            className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badgeClasses(
                              eligUi
                            )}`}
                          >
                            {eligUi}
                          </span>
                        </div>

                        <p className="text-[12px] text-uanco-500 truncate">
                          {email} {email && '•'} {String(treatment)}
                        </p>
                      </div>

                      <div className="text-[11px] text-uanco-400 whitespace-nowrap">{formatShortDate(d)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Clinic signals */}
        <div className="bg-white rounded-3xl border shadow-soft p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-uanco-400">Clinic signals</h3>
          <p className="text-[12px] text-uanco-500 mt-2">A quick snapshot from current logged data.</p>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Questions captured</span>
              <span className="text-sm font-medium text-uanco-900">{questions.length}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Safe rate</span>
              <span className="text-sm font-medium text-uanco-900">{Number(metrics?.passRate ?? 0)}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Drop-off rate</span>
              <span className="text-sm font-medium text-uanco-900">{Number(metrics?.dropOffRate ?? 0)}%</span>
            </div>
          </div>

          <div className="mt-6 text-[12px] text-uanco-500">
            Click a client to view their full pre-screen summary.
          </div>
        </div>
      </div>

      {/* Drilldown */}
      {selected && (
        <DrillDownPanel
          record={selected}
          prescreen={selected}
          onClose={() => setSelected(null)}
          onUpdateRecord={onUpdateRecord}
        />
      )}
    </div>
  );
};

export default Dashboard;