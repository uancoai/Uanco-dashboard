import React, { useMemo, useState } from 'react';
import DrillDownPanel from './DrillDownPanel';

type Props = {
  records: any[];
  dropOffs?: any[];
  onUpdateRecord?: (id: string, updates: any) => void;

  // optional: lets App.tsx route cleanly without relying on browser back
  onNavigate?: (view: string) => void;
};

type Tab = 'all' | 'safe' | 'review' | 'unsuitable';

function toLower(v: any) {
  return String(v ?? '').trim().toLowerCase();
}

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    // direct
    const direct = obj?.[k];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;

    // airtable-style: { fields: { ... } }
    const nested = obj?.fields?.[k];
    if (nested !== undefined && nested !== null && String(nested).trim() !== '') return nested;
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

/**
 * Airtable schema truth (from your AI output):
 * - eligibility: Pass | Fail | Manual Review
 * - manual_review_flag: single select → "Yes" means review
 * - hard stop: eligibility = Fail
 */

// Map Airtable eligibility → UI label
function baseEligibilityFromAirtable(raw: any): 'SAFE' | 'REVIEW' | 'UNSUITABLE' | '—' {
  const s = toLower(raw);

  if (s === 'pass') return 'SAFE';
  if (s === 'fail') return 'UNSUITABLE';
  if (s === 'manual review') return 'REVIEW';

  // support legacy values just in case older records exist
  if (s === 'safe') return 'SAFE';
  if (s === 'unsuitable') return 'UNSUITABLE';
  if (s === 'review') return 'REVIEW';

  return raw ? (String(raw).toUpperCase() as any) : '—';
}

function badgeClasses(label: string) {
  const s = toLower(label);
  if (s === 'safe') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'review') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}

function bookingBadgeClasses(status: 'Booked' | 'Pending') {
  if (status === 'Booked') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

// Manual review override: manual_review_flag === "Yes" wins unless review is completed
function isManualReview(rec: any) {
  const reviewComplete = getFirstNonEmpty(rec, ['Review Complete', 'review_complete', 'reviewComplete']);
  const reviewCompleteLower = toLower(reviewComplete);
  if (reviewComplete === true || reviewCompleteLower === 'true' || reviewCompleteLower === 'yes') return false;

  // If Airtable eligibility is Manual Review
  const eligRaw = getFirstNonEmpty(rec, ['eligibility', 'Eligibility']);
  if (toLower(eligRaw) === 'manual review') return true;

  // Your confirmed field:
  const flag = getFirstNonEmpty(rec, ['manual_review_flag']);
  return toLower(flag) === 'yes';
}

function effectiveUiEligibility(rec: any): 'SAFE' | 'REVIEW' | 'UNSUITABLE' | '—' {
  // Hard stop: Fail is always UNSUITABLE (even if manual_review_flag is Yes)
  const eligRaw = getFirstNonEmpty(rec, ['eligibility', 'Eligibility']);
  if (toLower(eligRaw) === 'fail') return 'UNSUITABLE';

  // Manual review override:
  if (isManualReview(rec)) return 'REVIEW';

  return baseEligibilityFromAirtable(eligRaw);
}

// Normalize record so DrillDownPanel gets consistent fields
function normalizeForPanel(r: any) {
  const name = getFirstNonEmpty(r, ['name', 'Name']) || 'Unnamed';
  const email = getFirstNonEmpty(r, ['email', 'Email']) || '';
  const phone = getFirstNonEmpty(r, ['phone', 'Phone', 'mobile', 'Mobile']) || '';
  const treatment =
    getFirstNonEmpty(r, ['treatment_selected', 'Treatment', 'interested_treatments', 'Interested Treatments']) || '';

  const eligibilityUi = effectiveUiEligibility(r);

  const bookingRaw = getFirstNonEmpty(r, ['booking_status', 'Booking Status', 'Booked', 'booked']);
  const bookingStatus: 'Booked' | 'Pending' = toLower(bookingRaw) === 'booked' ? 'Booked' : 'Pending';

  // ✅ IMPORTANT: include Airtable record-level createdTime as first fallback
  const ts =
    getFirstNonEmpty(r, [
      'Auto Created Time', // ✅ NEW Airtable formula field: CREATED_TIME()
      'auto_created_time', // optional snake_case fallback
      'createdTime', // Airtable record meta timestamp (if present)
      'Created time', // existing Airtable date field (if you ever populate it)
      'Created Time', // legacy
      'created_at',
      'Created',
      'submitted_at',
      'Submitted At',
      'webhook_timestamp',
      'Webhook Timestamp',
    ]) || null;

  return {
    ...r,
    name,
    email,
    phone,
    treatment_selected: treatment,
    eligibility: eligibilityUi,
    booking_status: bookingStatus,
    __raw: r,
    __ts: ts,
  };
}

const PreScreensView: React.FC<Props> = ({ records = [], dropOffs = [], onUpdateRecord, onNavigate }) => {
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  const normalized = useMemo(() => records.map(normalizeForPanel), [records]);

  const counts = useMemo(() => {
    let safe = 0,
      review = 0,
      unsuitable = 0;

    for (const r of normalized) {
      const e = toLower(r?.eligibility);
      if (e === 'safe') safe++;
      else if (e === 'review') review++;
      else if (e === 'unsuitable') unsuitable++;
    }

    return { all: normalized.length, safe, review, unsuitable };
  }, [normalized]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = [...normalized];

    if (tab !== 'all') {
      list = list.filter((r) => toLower(r?.eligibility) === tab);
    }

    if (needle) {
      list = list.filter((r) => {
        const name = toLower(r?.name);
        const email = toLower(r?.email);
        const treatment = toLower(r?.treatment_selected);
        return name.includes(needle) || email.includes(needle) || treatment.includes(needle);
      });
    }

    // Sort newest first
    list.sort((a, b) => {
      const da = parseDateMaybe(a.__ts);
      const db = parseDateMaybe(b.__ts);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });

    return list;
  }, [normalized, tab, q]);

  const toggleBooking = (r: any) => {
    if (!onUpdateRecord) return;
    const next: 'Booked' | 'Pending' = r.booking_status === 'Booked' ? 'Pending' : 'Booked';
    onUpdateRecord(r.id, { booking_status: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => {
              if (onNavigate) return onNavigate('overview');
              // fallback (still safe): reload to app root which defaults to Overview
              window.location.href = '/';
            }}
            className="mb-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-uanco-100 text-uanco-600 hover:bg-uanco-50"
            aria-label="Back to Overview"
          >
            ← Back
          </button>

          <h2 className="text-3xl font-serif">Pre-Screens</h2>
          <p className="text-[11px] text-uanco-400 mt-1">Review, approve, and track booking status.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 rounded-2xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${
              tab === 'all'
                ? 'bg-uanco-900 text-white border-uanco-900'
                : 'bg-white border-uanco-100 text-uanco-500 hover:bg-uanco-50'
            }`}
          >
            All ({counts.all})
          </button>

          <button
            onClick={() => setTab('safe')}
            className={`px-4 py-2 rounded-2xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${
              tab === 'safe'
                ? 'bg-uanco-900 text-white border-uanco-900'
                : 'bg-white border-uanco-100 text-uanco-500 hover:bg-uanco-50'
            }`}
          >
            Safe ({counts.safe})
          </button>

          <button
            onClick={() => setTab('review')}
            className={`px-4 py-2 rounded-2xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${
              tab === 'review'
                ? 'bg-uanco-900 text-white border-uanco-900'
                : 'bg-white border-uanco-100 text-uanco-500 hover:bg-uanco-50'
            }`}
          >
            Review ({counts.review})
          </button>

          <button
            onClick={() => setTab('unsuitable')}
            className={`px-4 py-2 rounded-2xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${
              tab === 'unsuitable'
                ? 'bg-uanco-900 text-white border-uanco-900'
                : 'bg-white border-uanco-100 text-uanco-500 hover:bg-uanco-50'
            }`}
          >
            Unsuitable ({counts.unsuitable})
          </button>
        </div>

        <div className="w-full sm:w-[340px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, treatment…"
            className="w-full bg-white border border-uanco-100 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-uanco-200"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl border shadow-soft overflow-hidden">
        <div className="hidden sm:block px-6 py-4 border-b bg-white/60">
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-5 text-[10px] font-bold uppercase tracking-widest text-uanco-400">Clients</div>
            <div className="col-span-3 text-[10px] font-bold uppercase tracking-widest text-uanco-400">Treatment</div>
            <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-uanco-400">Eligibility</div>
            <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-uanco-400 text-right">
              Booked
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-sm text-uanco-500">No records match your filters yet.</div>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => {
              const d = parseDateMaybe(r.__ts);

              return (
                <button
                  key={r.id || r.__raw?.id || `${r.email}-${r.__ts}`}
                  onClick={() => setSelected(r)}
                  className="w-full text-left px-6 py-4 hover:bg-uanco-50 transition-colors"
                >
                  <div className="flex flex-col gap-3 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center">
                    {/* MOBILE: top line (name + status/actions) */}
                    <div className="flex items-start justify-between gap-3 sm:hidden">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-[12px] text-uanco-500 truncate">{r.email || '—'}</p>
                        <p className="text-[11px] text-uanco-400 whitespace-nowrap mt-1">{formatShortDate(d)}</p>
                      </div>

                      <div className="shrink-0 flex flex-wrap justify-end gap-2">
                        <span
                          className={`inline-flex text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badgeClasses(
                            r.eligibility
                          )}`}
                        >
                          {r.eligibility}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleBooking(r);
                          }}
                          className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-1 rounded-full border transition-colors hover:opacity-90 ${bookingBadgeClasses(
                            r.booking_status
                          )}`}
                          title="Click to toggle Booked / Pending"
                        >
                          {r.booking_status === 'Booked' ? 'Booked' : 'Pending'}
                        </button>
                      </div>
                    </div>

                    {/* MOBILE: treatment line */}
                    <div className="sm:hidden">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-uanco-400">Treatment</p>
                      <p className="text-[12px] text-uanco-600 truncate">{String(r.treatment_selected || '—')}</p>
                    </div>

                    {/* DESKTOP: Clients */}
                    <div className="hidden sm:block sm:col-span-5 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-[12px] text-uanco-500 truncate">{r.email || '—'}</p>
                      <p className="text-[11px] text-uanco-400 whitespace-nowrap mt-1">{formatShortDate(d)}</p>
                    </div>

                    {/* DESKTOP: Treatment */}
                    <div className="hidden sm:block sm:col-span-3 min-w-0">
                      <p className="text-[12px] text-uanco-600 truncate">{String(r.treatment_selected || '—')}</p>
                    </div>

                    {/* DESKTOP: Eligibility */}
                    <div className="hidden sm:block sm:col-span-2">
                      <span
                        className={`inline-flex text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badgeClasses(
                          r.eligibility
                        )}`}
                      >
                        {r.eligibility}
                      </span>
                    </div>

                    {/* DESKTOP: Booked */}
                    <div className="hidden sm:flex sm:col-span-2 justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleBooking(r);
                        }}
                        className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-1 rounded-full border transition-colors hover:opacity-90 ${bookingBadgeClasses(
                          r.booking_status
                        )}`}
                        title="Click to toggle Booked / Pending"
                      >
                        {r.booking_status === 'Booked' ? 'Booked' : 'Pending'}
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <DrillDownPanel
          record={selected}
          prescreen={selected.__raw || selected}
          onClose={() => setSelected(null)}
          onUpdateRecord={onUpdateRecord}
        />
      )}
    </div>
  );
};

export default PreScreensView;