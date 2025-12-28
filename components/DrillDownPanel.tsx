import React, { useEffect, useMemo, useState } from 'react';
import { X, CalendarCheck, Check, Mail, Phone, AlertTriangle, ChevronRight } from 'lucide-react';

type Props = {
  record: any;        // normalized (name/email/eligibility/booking_status)
  prescreen?: any;    // raw Airtable fields (age_verified, pregnant_breastfeeding, etc.)
  onClose: () => void;
  onUpdateRecord?: (id: string, updates: any) => void;
};

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const direct = obj?.[k];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;

    const nested = obj?.fields?.[k];
    if (nested !== undefined && nested !== null && String(nested).trim() !== '') return nested;
  }
  return null;
}

function toLower(v: any) {
  return String(v ?? '').trim().toLowerCase();
}

function isTruthy(v: any) {
  const s = toLower(v);
  return v === true || s === 'true' || s === 'yes' || s === '1' || s === 'y';
}

function asTextList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  const s = String(v).trim();
  if (!s) return [];
  // supports "A, B, C" and also newline-separated values
  return s.split(/,|\n/).map((x) => x.trim()).filter(Boolean);
}

function buildReviewReasons(prescreen: any): string[] {
  const reasons: string[] = [];

  // 1) Explicit flag/reason fields (common Airtable/Make patterns)
  const contraindications = getFirstNonEmpty(prescreen, [
    'contraindications',
    'Contraindications',
    'medical_flags',
    'Medical Flags',
    'flags',
    'Flags',
    'flag_reasons',
    'Flag Reasons',
    'Fail Reasons',
    'fail_reasons',
  ]);
  asTextList(contraindications).forEach((r) => reasons.push(r));

  // 2) Allergies (Yes/No) + the detail (e.g. Shellfish)
  const allergies = getFirstNonEmpty(prescreen, [
    'allergies_yesno',
    'allergies',
    'Allergies',
  ]);
  const allergyDetail = getFirstNonEmpty(prescreen, [
    'allergy_detail',
    'allergy_details',
    'Allergy Detail',
    'Allergy Details',
    'Allergies (detail)',
    'Allergy',
  ]);

  const a = toLower(allergies);
  if (a === 'yes' || a === 'true') {
    if (allergyDetail) reasons.push(`Allergy: ${String(allergyDetail).trim()}`);
    else reasons.push('Allergy: Yes');
  } else if (allergies && a !== 'no' && a !== 'false') {
    // sometimes the allergies field contains the actual allergy text
    reasons.push(`Allergy: ${String(allergies).trim()}`);
  }

  // 3) Medications / conditions (often review triggers)
  const meds = getFirstNonEmpty(prescreen, ['medications', 'Medications']);
  asTextList(meds).forEach((m) => reasons.push(`Medication: ${m}`));

  const conditions = getFirstNonEmpty(prescreen, [
    'conditions',
    'Medical Conditions',
    'medical_conditions',
  ]);
  asTextList(conditions).forEach((c) => reasons.push(`Condition: ${c}`));

  // De-dupe and return
  return Array.from(new Set(reasons.map((r) => r.trim()).filter(Boolean)));
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

function eligBadgeClasses(label: string) {
  const s = String(label || '').toLowerCase();
  if (s === 'safe') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'review') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}

const DrillDownPanel: React.FC<Props> = ({ record, prescreen, onClose, onUpdateRecord }) => {
  const [mode, setMode] = useState<'default' | 'approved'>('default');

  // ✅ Local booking status so button updates instantly (even if parent state lags)
  const [bookingStatus, setBookingStatus] = useState<'Booked' | 'Pending'>('Pending');
  const [reviewCompleteChecked, setReviewCompleteChecked] = useState(false);
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    setMode('default');
    setReviewCompleteChecked(false);
    setConfirmReviewOpen(false);
    setSavingReview(false);
  }, [record?.id]);

  if (!record) return null;

  // Prefer raw Airtable fields for details
  const raw = prescreen || record;

  // Keep local booking status synced with incoming record
  useEffect(() => {
    const bookingStatusRaw =
      getFirstNonEmpty(raw, ['booking_status', 'Booking Status']) ??
      getFirstNonEmpty(record, ['booking_status', 'Booking Status']);

    const next: 'Booked' | 'Pending' =
      String(bookingStatusRaw || '').trim().toLowerCase() === 'booked' ? 'Booked' : 'Pending';

    setBookingStatus(next);
  }, [record?.id, record?.booking_status, raw?.booking_status]);

  // Prefer normalized, fall back to raw
  const name =
    getFirstNonEmpty(record, ['name', 'Name']) ||
    getFirstNonEmpty(raw, ['name', 'Name']) ||
    'Unnamed';

  const email =
    getFirstNonEmpty(record, ['email', 'Email']) ||
    getFirstNonEmpty(raw, ['email', 'Email']) ||
    '';

  const phone =
    getFirstNonEmpty(record, ['phone', 'Phone', 'mobile', 'Mobile']) ||
    getFirstNonEmpty(raw, ['phone', 'Phone', 'mobile', 'Mobile']) ||
    '';

  const treatment =
    getFirstNonEmpty(raw, ['interested_treatments', 'Interested Treatments', 'treatment_selected', 'Treatment']) ||
    getFirstNonEmpty(record, ['treatment_selected', 'Treatment']) ||
    '—';

  const eligibilityUi = toUiEligibility(
    getFirstNonEmpty(raw, ['eligibility', 'Eligibility']) ??
      getFirstNonEmpty(record, ['eligibility', 'Eligibility'])
  );

  const initials = name
    ? name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : '??';

  const toggleBooking = () => {
    if (!onUpdateRecord) return;
    const next: 'Booked' | 'Pending' = bookingStatus === 'Booked' ? 'Pending' : 'Booked';

    // ✅ instant visual change
    setBookingStatus(next);

    // ✅ propagate up to update table + persist to Airtable
    onUpdateRecord(record.id, { booking_status: next });
  };

  const markReviewComplete = async () => {
    if (!onUpdateRecord) return;
    try {
      setSavingReview(true);
      // Persist to Airtable via the existing update endpoint
      await onUpdateRecord(record.id, { review_complete: true, reviewComplete: true, 'Review Complete': true });
      setConfirmReviewOpen(false);
      setReviewCompleteChecked(false);
    } finally {
      setSavingReview(false);
    }
  };

  // Pre-screen rows (safe starter set)
  const preScreenRows = useMemo(() => {
    const rows = [
      { label: 'Over 18?', value: getFirstNonEmpty(raw, ['age_verified', 'Age Verified']) },
      {
        label: 'Pregnancy/Nursing?',
        value: getFirstNonEmpty(raw, ['pregnant_breastfeeding', 'pregnant_breastfeedinging', 'Pregnant/Breastfeeding']),
      },
      { label: 'Allergies?', value: getFirstNonEmpty(raw, ['allergies_yesno', 'Allergies', 'allergies']) },
      {
        label: 'Allergy details',
        value: getFirstNonEmpty(raw, [
          'allergy_detail',
          'allergy_details',
          'Allergy Detail',
          'Allergy Details',
          'Allergies (detail)',
        ]),
      },
      { label: 'Medications', value: getFirstNonEmpty(raw, ['medications', 'Medications']) },
      {
        label: 'Medical conditions',
        value: getFirstNonEmpty(raw, ['conditions', 'Medical Conditions', 'medical_conditions']),
      },
      { label: 'Antibiotics (14d)?', value: getFirstNonEmpty(raw, ['Antibiotics_14d', 'antibiotics_14d']) },
    ];

    return rows.filter((r) => r.value !== null && r.value !== undefined && String(r.value).trim() !== '');
  }, [raw]);

  const aiSummary = getFirstNonEmpty(raw, ['Pre-screen Summary (AI)', 'ai_summary', 'AI Summary']);
  const reviewReasons = useMemo(() => buildReviewReasons(raw), [raw]);
  const showReviewSignals = eligibilityUi === 'REVIEW' || reviewReasons.length > 0;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="bg-white w-full max-w-md shadow-2xl rounded-3xl overflow-hidden max-h-[85vh] flex flex-col pointer-events-auto ring-1 ring-slate-900/5">
          {/* Header */}
          <div className="p-6 pb-4 relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-300 hover:text-slate-500 transition-colors p-2 rounded-full hover:bg-slate-50"
            >
              <X size={20} />
            </button>

            <div className="flex gap-5 items-start mb-5">
              <div className="h-14 w-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 text-lg font-medium tracking-wide shrink-0">
                {initials}
              </div>

              <div className="flex-1 pt-1 min-w-0 pr-8">
                <h2 className="text-2xl font-serif font-medium text-slate-900 leading-none mb-3 truncate">
                  {name}
                </h2>

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 min-w-0">
                    {email && (
                      <div className="flex items-center gap-2 text-slate-500 min-w-0">
                        <Mail size={14} className="shrink-0" />
                        <a
                          href={`mailto:${email}`}
                          className="text-xs font-medium hover:text-slate-800 transition-colors truncate"
                        >
                          {email}
                        </a>
                      </div>
                    )}

                    {phone && (
                      <div className="flex items-center gap-2 text-slate-500 min-w-0">
                        <Phone size={14} className="shrink-0" />
                        <a
                          href={`tel:${phone}`}
                          className="text-xs font-medium hover:text-slate-800 transition-colors truncate"
                        >
                          {phone}
                        </a>
                      </div>
                    )}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${eligBadgeClasses(
                      eligibilityUi
                    )}`}
                  >
                    {eligibilityUi}
                  </span>
                </div>
              </div>
            </div>

            {/* Requested treatment */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Requested treatment
              </p>
              <p className="text-sm font-medium text-slate-900 truncate">• {String(treatment)}</p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 space-y-4 overflow-auto">
            {/* Review signals (why this is in review) */}
            {showReviewSignals && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-white/60 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Review signals</p>
                    <p className="text-xs text-slate-500 mt-0.5">What needs practitioner confirmation</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {phone && (
                      <a
                        href={`tel:${String(phone).replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-slate-100 text-slate-700 hover:bg-slate-50"
                      >
                        <Phone size={14} /> Call
                      </a>
                    )}
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-[#1a1a1a] text-white hover:bg-black"
                      >
                        <Mail size={14} /> Email
                      </a>
                    )}
                  </div>
                </div>

                {reviewReasons.length === 0 ? (
                  <div className="p-4 text-sm text-slate-600 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-800">This record is marked for review.</p>
                      <p className="text-xs text-slate-500 mt-1">
                        No structured reason fields were found yet. Next step is mapping the exact Airtable fields so this always shows details like “Allergy: Shellfish”.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {reviewReasons.map((r, idx) => (
                      <div key={idx} className="px-4 py-3 flex items-start gap-3">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-sm text-slate-800">{r}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-4 py-4 border-t border-slate-100 bg-white">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      checked={reviewCompleteChecked}
                      onChange={(e) => setReviewCompleteChecked(e.target.checked)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">Mark review as complete</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Only tick this if the client has been reviewed and it’s safe to proceed.
                      </p>
                    </div>
                  </label>

                  <button
                    type="button"
                    disabled={!reviewCompleteChecked || savingReview}
                    onClick={() => setConfirmReviewOpen(true)}
                    className={`mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors border ${
                      !reviewCompleteChecked || savingReview
                        ? 'bg-slate-50 text-slate-400 border-slate-100'
                        : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {savingReview ? 'Saving…' : 'Confirm review complete'} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
            {/* Pre-screen results */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 bg-white/60 border-b border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Pre-screen results
                </p>
              </div>

              {preScreenRows.length === 0 ? (
                <div className="p-4 text-sm text-slate-500 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  No pre-screen answers found on this record yet.
                </div>
              ) : (
                <div className="divide-y">
                  {preScreenRows.map((r) => (
                    <div key={r.label} className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-700">{r.label}</span>
                      <span className="text-sm font-medium text-slate-900 text-right truncate max-w-[55%]">
                        {String(r.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI summary */}
            {aiSummary && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  AI summary
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{String(aiSummary)}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-6 pt-4 border-t border-slate-50 bg-white space-y-3">
            <button
              className={`w-full py-3.5 rounded-xl font-medium text-sm transition-colors shadow-lg flex items-center justify-center gap-2 ${
                bookingStatus === 'Booked'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-none'
                  : 'bg-[#1a1a1a] text-white hover:bg-black'
              }`}
              onClick={toggleBooking}
            >
              {bookingStatus === 'Booked' ? (
                <>
                  <Check size={18} />
                  Booked (click to set Pending)
                </>
              ) : (
                <>
                  <CalendarCheck size={18} />
                  Mark as Booked
                </>
              )}
            </button>

            {mode === 'approved' && (
              <p className="text-xs text-slate-500 text-center">Updating eligibility…</p>
            )}
          </div>
        </div>
        {confirmReviewOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setConfirmReviewOpen(false)} />
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Confirm action</p>
                <h3 className="text-lg font-medium text-slate-900 mt-2">Mark this review as complete?</h3>
                <p className="text-sm text-slate-600 mt-2">
                  This will remove the “REVIEW” status and show the case as cleared.
                </p>
              </div>
              <div className="p-4 border-t border-slate-100 bg-white flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReviewOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={markReviewComplete}
                  disabled={savingReview}
                  className="flex-1 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-[#1a1a1a] text-white hover:bg-black disabled:opacity-60"
                >
                  {savingReview ? 'Saving…' : 'Yes, complete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DrillDownPanel;