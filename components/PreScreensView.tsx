import React, { useMemo, useState } from 'react';
import DrillDownPanel from './DrillDownPanel';

type Props = {
  records: any[];
  dropOffs?: any[];
  onUpdateRecord?: (id: string, updates: any) => void;
};

type Tab = 'all' | 'safe' | 'review' | 'unsuitable';

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

// Airtable → UI label
function toUiEligibility(raw: any): 'SAFE' | 'REVIEW' | 'UNSUITABLE' | '—' {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pass') return 'SAFE';
  if (s === 'review') return 'REVIEW';
  if (s === 'fail') return 'UNSUITABLE';
  // Sometimes Airtable stores already-formatted values
  if (s === 'safe') return 'SAFE';
  if (s === 'unsuitable') return 'UNSUITABLE';
  return raw ? (String(raw).toUpperCase() as any) : '—';
}

// Creates a "normalized" record so DrillDownPanel always has what it expects,
// while still keeping original Airtable fields available (we attach `__raw`).
function normalizeForPanel(r: any) {
  const name = getFirstNonEmpty(r, ['name', 'Name']) || 'Unnamed';
  const email = getFirstNonEmpty(r, ['email', 'Email']) || '';
  const phone = getFirstNonEmpty(r, ['phone', 'Phone', 'mobile', 'Mobile']) || '';
  const treatment =
    getFirstNonEmpty(r, ['treatment_selected', 'Treatment', 'interested_treatments', 'Interested Treatments']) || '';

  // Keep original eligibility value for updates, but show UI label
  const eligibilityRaw = getFirstNonEmpty(r, ['eligibility', 'Eligibility']);
  const eligibilityUi = toUiEligibility(eligibilityRaw);

  // Keep timestamps for sorting (supports webhook_timestamp)
  const ts =
    getFirstNonEmpty(r, [
      'webhook_timestamp',
      'Webhook Timestamp',
      'created_at',
      'Created',
      'Created Time',
      'submitted_at',
      'Submitted At',
    ]) || null;

  return {
    ...r,
    name,
    email,
    phone,
    treatment_selected: treatment,
    eligibility: eligibilityUi, // what the panel displays
    __raw: r,
    __ts: ts,
  };
}

function badgeClasses(label: string) {
  const s = String(label || '').toLowerCase();
  if (s === 'safe') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'review') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}

const PreScreensView: React.FC<Props> = ({ records = [], dropOffs = [], onUpdateRecord }) => {
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  const normalized = useMemo(() => records.map(normalizeForPanel), [records]);

  const counts = useMemo(() => {
    let safe = 0,
      review = 0,
      unsuitable = 0;
    for (const r of normalized) {
      const e = String(r?.eligibility || '').toLowerCase();
      if (e === 'safe') safe++;
      else if (e === 'review') review++;
      else if (e === 'unsuitable') unsuitable++;
    }
    return { all: normalized.length, safe, review, unsuitable };
  }, [normalized]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let list = [...normalized];

    // Tab filter
    if (tab !== 'all') {
      list = list.filter((r) => String(r?.eligibility || '').toLowerCase() === tab);
    }

    // Search filter
    if (needle) {
      list = list.filter((r) => {
        const name = String(r?.name || '').toLowerCase();
        const email = String(r?.email || '').toLowerCase();
        const treatment = String(r?.treatment_selected || '').toLowerCase();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-serif">Pre-Screens</h2>
          <p className="text-[11px] text-uanco-400 mt-1">Review, approve, and track booking status.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 rounded-2xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${
              tab === 'all' ? 'bg-uanco-900 text-white border-uanco-900' : 'bg-white border-uanco-100 text-uanco-500 hover:bg-uanco-50'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => setTab('safe')}
            className={`px-4 py-2 rounded-2xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${
              tab === 'safe' ? 'bg-uanco-900 text-white border-uanco-900' : 'bg-white border-uanco-100 text-uanco-500 hover:bg-uanco-50'
            }`}
          >
            Safe ({counts.safe})
          </button>
          <button
            onClick={() => setTab('review')}
            className={`px-4 py-2 rounded-2xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${
              tab === 'review' ? 'bg-uanco-900 text-white border-uanco-900' : 'bg-white border-uanco-100 text-uanco-500 hover:bg-uanco-50'
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

        {/* Search */}
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
        <div className="px-6 py-5 border-b bg-white/60">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Patient Records</p>
            <p className="text-[11px] text-uanco-400">{filtered.length} shown</p>
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
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full text-left px-6 py-4 hover:bg-uanco-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badgeClasses(r.eligibility)}`}
                        >
                          {r.eligibility}
                        </span>
                      </div>

                      <p className="text-[12px] text-uanco-500 truncate">
                        {r.email} {r.email && '•'} {String(r.treatment_selected || '—')}
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

      {/* Drilldown */}
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