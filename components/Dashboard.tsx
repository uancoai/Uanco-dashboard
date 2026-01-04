import React, { useMemo, useState } from 'react';
import KPICard from './KPICard';
import DrillDownPanel from './DrillDownPanel';
import { ArrowRight, RefreshCw } from 'lucide-react';

type Props = {
  clinicId?: string;
  clinicName?: string;
  onNavigate: (view: string) => void;

  preScreens?: any[];
  dropOffs?: any[];
  questions?: any[];
  metrics?: any;

  onUpdateRecord?: (id: string, updates: any) => void;
  onRefresh?: () => void | Promise<void>;
};

function toLower(v: any) {
  return String(v ?? '').trim().toLowerCase();
}

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const direct = obj?.[k];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;

    const nested = obj?.fields?.[k];
    if (nested !== undefined && nested !== null && String(nested).trim() !== '') return nested;
  }
  return null;
}

function isTruthy(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  return v === true || s === 'true' || s === 'yes' || s === '1' || s === 'y';
}

// ✅ Review override logic: flagged-for-review wins unless review marked complete
function isManualReview(rec: any) {
  const reviewComplete = getFirstNonEmpty(rec, ['Review Complete', 'review_complete', 'reviewComplete']);
  if (isTruthy(reviewComplete)) return false;

  const e = toLower(getFirstNonEmpty(rec, ['eligibility', 'Eligibility']));
  if (e === 'manual review' || e === 'review') return true;

  const explicitFlag = getFirstNonEmpty(rec, [
    'manual_review_flag',
    'Manual Review Flag',
    'Flagged for Review',
    'flagged_for_review',
    'manual_review',
    'Manual Review',
    'review_flag',
    'Review Flag',
    'flagged',
    'Flagged',
  ]);

  return isTruthy(explicitFlag);
}

function toUiEligibility(rec: any): 'SAFE' | 'REVIEW' | 'UNSUITABLE' | '—' {
  const raw = getFirstNonEmpty(rec, ['eligibility', 'Eligibility']);
  const s = toLower(raw);

  // ✅ HARD-STOP: Fail/Unsuitable always wins (even if someone also flagged it for review)
  if (s === 'fail' || s === 'unsuitable') return 'UNSUITABLE';

  // ✅ Review override next (unless review marked complete inside isManualReview)
  if (isManualReview(rec)) return 'REVIEW';

  if (s === 'pass' || s === 'safe') return 'SAFE';
  if (s === 'manual review' || s === 'review') return 'REVIEW';

  return raw ? (String(raw).toUpperCase() as any) : '—';
}

function badgeClasses(label: string) {
  const s = toLower(label);
  if (s === 'safe') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'review') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}

function parseDateMaybe(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getBestTimestampValue(rec: any) {
  // Priority order: Airtable record meta -> formula created time -> legacy fields -> webhook
  return getFirstNonEmpty(rec, [
    'createdTime',
    'Auto Created Time',
    'auto_created_time',
    'autoCreatedTime',
    'Created time',
    'Created Time',
    'created_at',
    'Created',
    'submitted_at',
    'Submitted At',
    'webhook_timestamp',
    'Webhook Timestamp',
  ]);
}

function getBestTimestampDate(rec: any) {
  return parseDateMaybe(getBestTimestampValue(rec));
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

function isBooked(rec: any) {
  const raw = getFirstNonEmpty(rec, ['booking_status', 'Booking Status', 'booked', 'Booked']);
  return toLower(raw) === 'booked';
}

function normalizeIntent(v: any): 'ready' | 'hesitate' | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;

  // tolerate different labels
  if (s.includes('ready')) return 'ready';
  if (s.includes('hesitat')) return 'hesitate';
  if (s.includes('not ready')) return 'hesitate';

  if (s === 'ready') return 'ready';
  if (s === 'hesitate') return 'hesitate';

  return null;
}

function getBookingIntent(rec: any) {
  return getFirstNonEmpty(rec, ['booking_intent', 'Booking Intent', 'bookingIntent']);
}

function getHesitationReason(rec: any) {
  return getFirstNonEmpty(rec, [
    'booking_hesitation_reason',
    'Booking Hesitation Reason',
    'hesitation_reason',
    'Hesitation Reason',
  ]);
}

const Dashboard: React.FC<Props> = ({
  clinicId,
  clinicName,
  onNavigate,
  preScreens = [],
  questions = [],
  metrics = {},
  onUpdateRecord,
  onRefresh,
}) => {
  const [selected, setSelected] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const totals = useMemo(() => {
    // ✅ Single source of truth: what the UI is actually rendering
    const total = preScreens.length;

    const reviewCount = preScreens.filter((r: any) => toUiEligibility(r) === 'REVIEW').length;
    const unsafeCount = preScreens.filter((r: any) => toUiEligibility(r) === 'UNSUITABLE').length;
    const safeCount = preScreens.filter((r: any) => toUiEligibility(r) === 'SAFE').length;

    const booked = preScreens.filter(isBooked).length;

    // Dropoffs: prefer explicit count if backend provides it, else estimate from rate
    const dropOffRate = Number(metrics?.dropOffRate ?? 0);
    const dropoffs =
      Number.isFinite(Number(metrics?.dropoffs ?? metrics?.dropOffs ?? metrics?.dropOffsCount))
        ? Number(metrics?.dropoffs ?? metrics?.dropOffs ?? metrics?.dropOffsCount)
        : Number.isFinite(dropOffRate)
        ? Math.round(total * (dropOffRate / 100))
        : 0;

    return {
      total,
      safeToBook: safeCount,
      review: reviewCount,
      dropoffs,
      booked,
      unsafe: unsafeCount,
    };
  }, [metrics, preScreens]);

  const recent = useMemo(() => {
    const copy = [...preScreens];

    copy.sort((a, b) => {
      const da = getBestTimestampDate(a);
      const db = getBestTimestampDate(b);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });

    return copy.slice(0, 8);
  }, [preScreens]);

  const safeRateUi = useMemo(() => {
    const total = preScreens.length;
    if (!total) return 0;
    const safeCount = preScreens.filter((r: any) => toUiEligibility(r) === 'SAFE').length;
    return Math.round((safeCount / total) * 100);
  }, [preScreens]);

  const dropOffRateUi = useMemo(() => {
    const total = preScreens.length;
    if (!total) return 0;
    const dropoffs = Number(totals.dropoffs ?? 0);
    return Math.round((dropoffs / total) * 100);
  }, [preScreens, totals.dropoffs]);

  const bookingSignals = useMemo(() => {
    const reasons: Record<string, number> = {};
    let ready = 0;
    let hesitate = 0;

    for (const r of preScreens) {
      const intent = normalizeIntent(getBookingIntent(r));
      if (!intent) continue;

      if (intent === 'ready') ready++;
      if (intent === 'hesitate') {
        hesitate++;
        const reasonRaw = getHesitationReason(r);
        const reason = String(reasonRaw ?? '').trim();
        if (reason) reasons[reason] = (reasons[reason] || 0) + 1;
      }
    }

    const captured = ready + hesitate;
    const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return { captured, ready, hesitate, topReason };
  }, [preScreens]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-3xl font-serif truncate">Overview</h2>
      </div>

        <div className="flex items-center gap-3 shrink-0">
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className={`inline-flex items-center justify-center h-10 w-10 rounded-2xl border border-uanco-100 bg-white text-uanco-600 transition-colors ${
                refreshing
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:bg-uanco-50 hover:text-uanco-900'
              }`}
              aria-label="Refresh"
              title={refreshing ? 'Refreshing…' : 'Refresh'}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          )}

          <span className="text-xs font-bold text-uanco-400 uppercase tracking-widest">
            {clinicName || clinicId || 'Clinic'}
          </span>
        </div>
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
                const treatment =
                  getFirstNonEmpty(r, [
                    'interested_treatments',
                    'Interested Treatments',
                    'treatment_selected',
                    'Treatment',
                  ]) || '—';

                const eligUi = toUiEligibility(r);

                const d = getBestTimestampDate(r);

                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="w-full text-left px-6 py-4 hover:bg-uanco-50 transition-colors"
                  >
                    <div className="flex items-start sm:items-center justify-between gap-4 min-w-0">
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
                          <span>{String(treatment)}</span>
                        </p>
                      </div>
                      <div className="text-[11px] text-uanco-400 whitespace-nowrap shrink-0 text-right">{formatShortDate(d)}</div>
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
              <span className="text-sm font-medium text-uanco-900">{safeRateUi}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Drop-off rate</span>
              <span className="text-sm font-medium text-uanco-900">{dropOffRateUi}%</span>
            </div>

            <div className="pt-4 mt-1 border-t border-uanco-100" />

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Booking intent captured</span>
              <span className="text-sm font-medium text-uanco-900">{bookingSignals.captured}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Ready to book</span>
              <span className="text-sm font-medium text-uanco-900">{bookingSignals.ready}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Hesitating</span>
              <span className="text-sm font-medium text-uanco-900">{bookingSignals.hesitate}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Top hesitation</span>
              <span className="text-sm font-medium text-uanco-900 truncate max-w-[160px] text-right">
                {bookingSignals.topReason}
              </span>
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