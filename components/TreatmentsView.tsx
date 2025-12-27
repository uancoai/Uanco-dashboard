import React, { useMemo } from 'react';

type Props = {
  records: any[];
  questions?: any[];
};

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

function toUiEligibility(raw: any): 'SAFE' | 'REVIEW' | 'UNSUITABLE' | '—' {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pass') return 'SAFE';
  if (s === 'review') return 'REVIEW';
  if (s === 'fail') return 'UNSUITABLE';
  if (s === 'safe') return 'SAFE';
  if (s === 'unsuitable') return 'UNSUITABLE';
  return raw ? (String(raw).toUpperCase() as any) : '—';
}

function isBooked(raw: any) {
  return String(raw || '').trim().toLowerCase() === 'booked';
}

function parseTreatments(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map(s => s.trim()).filter(Boolean);
  // Airtable sometimes gives "Lip fillers" or "Lip fillers, Chin filler"
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const TreatmentsView: React.FC<Props> = ({ records = [], questions = [] }) => {
  const treatmentRows = useMemo(() => {
    const map = new Map<
      string,
      { treatment: string; total: number; safe: number; review: number; unsuitable: number; booked: number }
    >();

    for (const r of records) {
      const tRaw = getFirstNonEmpty(r, ['interested_treatments', 'Interested Treatments', 'treatment_selected', 'Treatment']);
      const treatments = parseTreatments(tRaw);

      // If no treatment, skip — or group it as "Unspecified" if you want
      if (treatments.length === 0) continue;

      const elig = toUiEligibility(getFirstNonEmpty(r, ['eligibility', 'Eligibility']));
      const booked = isBooked(getFirstNonEmpty(r, ['booking_status', 'Booking Status']));

      for (const treatment of treatments) {
        if (!map.has(treatment)) {
          map.set(treatment, { treatment, total: 0, safe: 0, review: 0, unsuitable: 0, booked: 0 });
        }
        const row = map.get(treatment)!;

        row.total += 1;
        if (elig === 'SAFE') row.safe += 1;
        else if (elig === 'REVIEW') row.review += 1;
        else if (elig === 'UNSUITABLE') row.unsuitable += 1;

        if (booked) row.booked += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [records]);

  const totals = useMemo(() => {
    let total = 0, safe = 0, review = 0, unsuitable = 0, booked = 0;
    for (const r of records) {
      total += 1;
      const elig = toUiEligibility(getFirstNonEmpty(r, ['eligibility', 'Eligibility']));
      if (elig === 'SAFE') safe += 1;
      else if (elig === 'REVIEW') review += 1;
      else if (elig === 'UNSUITABLE') unsuitable += 1;

      if (isBooked(getFirstNonEmpty(r, ['booking_status', 'Booking Status']))) booked += 1;
    }
    return { total, safe, review, unsuitable, booked, questions: questions?.length ?? 0 };
  }, [records, questions]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-serif">AI Insight</h2>
          <p className="text-[11px] text-uanco-400 mt-1">Simple totals by treatment (practitioner-friendly).</p>
        </div>
      </div>

      {/* Simple top summary */}
      <div className="bg-white rounded-3xl border shadow-soft p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-uanco-300">Overall (last 30 days)</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <div><span className="text-uanco-400">Total</span><div className="text-xl font-medium text-uanco-900">{totals.total}</div></div>
          <div><span className="text-uanco-400">SAFE</span><div className="text-xl font-medium text-uanco-900">{totals.safe}</div></div>
          <div><span className="text-uanco-400">REVIEW</span><div className="text-xl font-medium text-uanco-900">{totals.review}</div></div>
          <div><span className="text-uanco-400">UNSUITABLE</span><div className="text-xl font-medium text-uanco-900">{totals.unsuitable}</div></div>
          <div><span className="text-uanco-400">BOOKED</span><div className="text-xl font-medium text-uanco-900">{totals.booked}</div></div>
          <div><span className="text-uanco-400">Questions</span><div className="text-xl font-medium text-uanco-900">{totals.questions}</div></div>
        </div>
      </div>

      {/* Per-treatment cards */}
      {treatmentRows.length === 0 ? (
        <div className="bg-white rounded-3xl border shadow-soft p-8 text-sm text-uanco-500">
          No treatment selections found yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {treatmentRows.map((t) => (
            <div key={t.treatment} className="bg-white rounded-3xl border shadow-soft p-6">
              <h3 className="font-medium text-uanco-900 truncate">{t.treatment}</h3>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-uanco-400">Total</span>
                  <span className="font-medium">{t.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-uanco-400">BOOKED</span>
                  <span className="font-medium">{t.booked}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-uanco-400">SAFE</span>
                  <span className="font-medium">{t.safe}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-uanco-400">REVIEW</span>
                  <span className="font-medium">{t.review}</span>
                </div>

                <div className="flex items-center justify-between col-span-2">
                  <span className="text-uanco-400">UNSUITABLE</span>
                  <span className="font-medium">{t.unsuitable}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TreatmentsView;
