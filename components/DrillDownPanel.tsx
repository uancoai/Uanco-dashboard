import React, { useEffect, useMemo, useState } from 'react';
import { X, CalendarCheck, Check, Mail, Phone, AlertTriangle, ChevronRight } from 'lucide-react';

type Props = {
  record: any; // normalized (name/email/eligibility/booking_status)
  prescreen?: any; // raw Airtable fields (age_verified, pregnant_breastfeeding, etc.)
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
  return s.split(/,|\n/).map((x) => x.trim()).filter(Boolean);
}

function buildReviewReasons(prescreen: any): string[] {
  const reasons: string[] = [];

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

  const allergies = getFirstNonEmpty(prescreen, ['allergies_yesno', 'allergies', 'Allergies']);
  const allergyDetail = getFirstNonEmpty(prescreen, [
    'allergies_details',
    'allergies_detail',
    'allergy_details',
    'allergy_detail',
    'Allergies Details',
    'Allergies Detail',
    'Allergy Details',
    'Allergy Detail',
    'Allergies (detail)',
    'Allergy',
  ]);

  const a = toLower(allergies);
  // Only flag allergies when the answer is explicitly Yes/true
  if (a === 'yes' || a === 'true') {
    if (allergyDetail) reasons.push(`Allergy: ${String(allergyDetail).trim()}`);
    else reasons.push('Allergy: Yes');
  }

  const preg = getFirstNonEmpty(prescreen, [
    'pregnant_breastfeeding',
    'pregnant_breastfeedinging',
    'Pregnant/Breastfeeding',
    'Pregnant Breastfeeding',
    'pregnant_breastfeed',
  ]);

  const p = toLower(preg);
  if (p === 'yes' || p === 'true') {
    reasons.push('Pregnancy/Breastfeeding: Yes');
  } else if (p === 'not sure' || p === 'unsure' || p === 'maybe') {
    reasons.push('Pregnancy/Breastfeeding: Not sure');
  } else if (preg && p !== 'no' && p !== 'false') {
    reasons.push(`Pregnancy/Breastfeeding: ${String(preg).trim()}`);
  }

  // Antibiotics (14d) — treat Yes as a review signal
  const abx = getFirstNonEmpty(prescreen, [
    'antibiotics_14d',
    'Antibiotics_14d',
    'Antibiotics 14d',
    'Antibiotics (14d)',
    'Antibiotics (14 days)',
  ]);
  const abxVal = toLower(abx);
  if (abxVal === 'yes' || abxVal === 'true') {
    reasons.push('Antibiotics (14d): Yes');
  }

  const meds = getFirstNonEmpty(prescreen, ['medications', 'Medications']);
  asTextList(meds).forEach((m) => reasons.push(`Medication: ${m}`));

  const conditions = getFirstNonEmpty(prescreen, ['conditions', 'Medical Conditions', 'medical_conditions']);
  asTextList(conditions).forEach((c) => reasons.push(`Condition: ${c}`));

  const intent = getFirstNonEmpty(prescreen, ['booking_intent', 'Booking Intent', 'bookingIntent', 'Booking intent']);
  const hesitation = getFirstNonEmpty(prescreen, [
    'booking_hesitation_reason',
    'Booking Hesitation Reason',
    'bookingHesitationReason',
    'Hesitation Reason',
    'hesitation_reason',
  ]);

  if (intent) reasons.push(`Booking intent: ${String(intent).trim()}`);
  if (hesitation) reasons.push(`Hesitation: ${String(hesitation).trim()}`);

  return Array.from(new Set(reasons.map((r) => r.trim()).filter(Boolean)));
}
// Helper to detect review triggers even if Airtable did not set Manual Review Flag
function hasReviewTriggers(rec: any) {
  // If review already completed locally, do not treat anything as a live trigger
  const reviewComplete = getFirstNonEmpty(rec, ['Review Complete', 'review_complete', 'reviewComplete']);
  if (isTruthy(reviewComplete)) return false;

  // Pregnancy/Breastfeeding: Yes or Not sure
  const preg = getFirstNonEmpty(rec, [
    'pregnant_breastfeeding',
    'pregnant_breastfeedinging',
    'Pregnant/Breastfeeding',
    'Pregnant Breastfeeding',
    'pregnant_breastfeed',
  ]);
  const p = toLower(preg);
  const pregTrigger = p === 'yes' || p === 'true' || p === 'not sure' || p === 'unsure' || p === 'maybe';

  // Allergies: Yes only ("Not sure" is not an option)
  const allergies = getFirstNonEmpty(rec, ['allergies_yesno', 'allergies', 'Allergies']);
  const a = toLower(allergies);
  const allergyTrigger = a === 'yes' || a === 'true';

  // Antibiotics (14d): Yes only
  const abx = getFirstNonEmpty(rec, [
    'antibiotics_14d',
    'Antibiotics_14d',
    'Antibiotics 14d',
    'Antibiotics (14d)',
    'Antibiotics (14 days)',
  ]);
  const abxVal = toLower(abx);
  const abxTrigger = abxVal === 'yes' || abxVal === 'true';

  return pregTrigger || allergyTrigger || abxTrigger;
}

function buildUnsuitableSignals(rec: any): string[] {
  const signals: string[] = [];

  const cat = String(
    getFirstNonEmpty(rec, [
      'fail_reason_category_calc',
      'Fail Reason Category (Calc)',
      'fail_reason_category',
      'Fail Reason Category',
    ]) ?? ''
  )
    .trim()
    .toUpperCase();

  if (cat === 'PREGNANT_BREASTFEEDING') signals.push('Pregnant / breastfeeding');
  if (cat === 'ANTIBIOTICS') signals.push('Antibiotics in last 14 days');

  const preg = getFirstNonEmpty(rec, [
    'pregnant_breastfeeding',
    'pregnant_breastfeedinging',
    'Pregnant/Breastfeeding',
    'Pregnant Breastfeeding',
    'pregnant_breastfeed',
  ]);
  const p = toLower(preg);
  if (p === 'yes' || p === 'true') {
    if (!signals.includes('Pregnant / breastfeeding')) signals.push('Pregnant / breastfeeding');
  }

  const abx = getFirstNonEmpty(rec, [
    'antibiotics_14d',
    'Antibiotics_14d',
    'Antibiotics 14d',
    'Antibiotics (14d)',
    'Antibiotics (14 days)',
  ]);
  const ax = toLower(abx);
  if (ax === 'yes' || ax === 'true' || ax.includes('yes')) {
    if (!signals.includes('Antibiotics in last 14 days')) signals.push('Antibiotics in last 14 days');
  }

  return Array.from(new Set(signals));
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

function isManualReview(rec: any, localReviewComplete?: boolean) {
  if (localReviewComplete === true) return false;

  const reviewComplete = getFirstNonEmpty(rec, ['Review Complete', 'review_complete', 'reviewComplete']);
  if (isTruthy(reviewComplete)) return false;

  const e = toLower(getFirstNonEmpty(rec, ['eligibility', 'Eligibility']));
  if (e === 'review') return true;

  const explicitFlag = getFirstNonEmpty(rec, [
    'Manual Review Flag',
    'manual_review_flag',
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

// ✅ NEW: detect clearance flag so UNSUITABLE can be booked only after clearance
function isClearedForFutureBooking(rec: any) {
  const v = getFirstNonEmpty(rec, [
    'cleared_for_future_booking',
    'Cleared For Future Booking',
    'Cleared for future booking',
    'clearedForFutureBooking',
  ]);
  return isTruthy(v);
}

const DrillDownPanel: React.FC<Props> = ({ record, prescreen, onClose, onUpdateRecord }) => {
  const [mode, setMode] = useState<'default' | 'approved'>('default');
  const [bookingStatus, setBookingStatus] = useState<'Booked' | 'Pending'>('Pending');

  const [reviewCompleteChecked, setReviewCompleteChecked] = useState(false);
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  const [localReviewComplete, setLocalReviewComplete] = useState(false);
  const [localCleared, setLocalCleared] = useState(false);

  if (!record) return null;

  const raw = prescreen || record;

  useEffect(() => {
    setMode('default');
    setReviewCompleteChecked(false);
    setConfirmReviewOpen(false);
    setSavingReview(false);

    const existing = getFirstNonEmpty(raw, ['Review Complete', 'review_complete', 'reviewComplete']);
    setLocalReviewComplete(isTruthy(existing));

    setLocalCleared(isClearedForFutureBooking(raw));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  useEffect(() => {
    const bookingStatusRaw =
      getFirstNonEmpty(raw, ['booking_status', 'Booking Status']) ??
      getFirstNonEmpty(record, ['booking_status', 'Booking Status']);

    const next: 'Booked' | 'Pending' =
      String(bookingStatusRaw || '').trim().toLowerCase() === 'booked' ? 'Booked' : 'Pending';

    setBookingStatus(next);
  }, [record?.id, record?.booking_status, raw?.booking_status]);

  const name = getFirstNonEmpty(record, ['name', 'Name']) || getFirstNonEmpty(raw, ['name', 'Name']) || 'Unnamed';
  const email = getFirstNonEmpty(record, ['email', 'Email']) || getFirstNonEmpty(raw, ['email', 'Email']) || '';
  const phone =
    getFirstNonEmpty(record, ['phone', 'Phone', 'mobile', 'Mobile']) ||
    getFirstNonEmpty(raw, ['phone', 'Phone', 'mobile', 'Mobile']) ||
    '';

  const treatment =
    getFirstNonEmpty(raw, ['interested_treatments', 'Interested Treatments', 'treatment_selected', 'Treatment']) ||
    getFirstNonEmpty(record, ['treatment_selected', 'Treatment']) ||
    '—';

  const bookingIntent =
    getFirstNonEmpty(raw, ['booking_intent', 'Booking Intent', 'bookingIntent', 'Booking intent']) ||
    getFirstNonEmpty(record, ['booking_intent', 'Booking Intent', 'bookingIntent', 'Booking intent']) ||
    '';

  const bookingHesitationReason =
    getFirstNonEmpty(raw, [
      'booking_hesitation_reason',
      'Booking Hesitation Reason',
      'bookingHesitationReason',
      'Hesitation Reason',
      'hesitation_reason',
    ]) ||
    getFirstNonEmpty(record, [
      'booking_hesitation_reason',
      'Booking Hesitation Reason',
      'bookingHesitationReason',
      'Hesitation Reason',
      'hesitation_reason',
    ]) ||
    '';

  // ✅ Effective eligibility: FAIL/UNSUITABLE always wins, otherwise REVIEW if manual flag or any triggers
  const eligibilityUi: 'SAFE' | 'REVIEW' | 'UNSUITABLE' | '—' = useMemo(() => {
    const rawElig =
      getFirstNonEmpty(raw, ['eligibility', 'Eligibility']) ?? getFirstNonEmpty(record, ['eligibility', 'Eligibility']);

    const base = toUiEligibility(rawElig);

    // Hard-stop: FAIL/UNSUITABLE always wins
    if (base === 'UNSUITABLE') return 'UNSUITABLE';

    // REVIEW when flagged-for-review (unless review completed)
    if (isManualReview(raw, localReviewComplete)) return 'REVIEW';

    // REVIEW when any trigger answers indicate review is needed (unless review completed)
    if (!localReviewComplete && hasReviewTriggers(raw)) return 'REVIEW';

    return base;
  }, [raw, record, localReviewComplete]);

  const initials = name
    ? name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : '??';

  const reviewReasons = useMemo(() => buildReviewReasons(raw), [raw]);

  const unsuitableSignals = useMemo(() => {
    if (eligibilityUi !== 'UNSUITABLE') return [];
    return buildUnsuitableSignals(raw);
  }, [eligibilityUi, raw]);

  const showReviewSignals = eligibilityUi === 'REVIEW';
  const showUnsuitableSignals = eligibilityUi === 'UNSUITABLE' && unsuitableSignals.length > 0;

  const isUnsuitable = eligibilityUi === 'UNSUITABLE';
  const showClearancePanel = showReviewSignals || showUnsuitableSignals;

  const clearanceTitle = isUnsuitable ? 'Clinic override: cleared for future booking' : 'Mark review as complete';
  const clearanceHelper = isUnsuitable
    ? "Use this when the client is unsuitable due to a temporary reason (e.g. antibiotics window or pregnancy/breastfeeding) but you’re happy to book them in advance. This does not change the original pre-screen answers."
    : "Only tick this if you’ve reviewed the client and you’re happy for them to book in future. If they can’t book online today, you can book them manually.";
  const clearanceButtonLabel = isUnsuitable ? 'Confirm clinic clearance' : 'Confirm review complete';

  // ✅ Booking gating rule
  const bookingLocked = isUnsuitable && !localCleared;

  const toggleBooking = () => {
    if (!onUpdateRecord) return;
    if (bookingLocked) return;

    const next: 'Booked' | 'Pending' = bookingStatus === 'Booked' ? 'Pending' : 'Booked';
    setBookingStatus(next);
    onUpdateRecord(record.id, { booking_status: next });
  };

  const markReviewComplete = async () => {
    if (!onUpdateRecord) return;

    try {
      setSavingReview(true);

      const currentElig = toLower(getFirstNonEmpty(raw, ['eligibility', 'Eligibility']));

      if (eligibilityUi === 'UNSUITABLE') {
        const nowIso = new Date().toISOString();

        const updates: any = {
          cleared_for_future_booking: true,
        };

        const hasClearedAt = getFirstNonEmpty(raw, ['cleared_at', 'Cleared At']) !== null;
        const hasClearedBy = getFirstNonEmpty(raw, ['cleared_by', 'Cleared By']) !== null;
        const hasClearanceNote = getFirstNonEmpty(raw, ['clearance_note', 'Clearance Note']) !== null;

        if (hasClearedAt) updates.cleared_at = nowIso;
        if (hasClearedBy) updates.cleared_by = 'Practitioner';
        if (hasClearanceNote) updates.clearance_note = '';

        try {
          await onUpdateRecord(record.id, updates);
        } catch (err) {
          console.warn('[markReviewComplete] clearance update failed, retrying minimal payload', err);
          await onUpdateRecord(record.id, { cleared_for_future_booking: true });
        }

        setLocalCleared(true);
        setSavingReview(false);
        setConfirmReviewOpen(false);
        setReviewCompleteChecked(false);
      } else {
        const updates: any = {
          review_complete: true,
          reviewComplete: true,
          'Review Complete': true,

          'Manual Review Flag': false,
          manual_review_flag: false,
          'Flagged for Review': false,
          flagged_for_review: false,
          manual_review: false,
          'Manual Review': false,
          review_flag: false,
          'Review Flag': false,
          flagged: false,
          'Flagged': false,
        };

        if (currentElig === 'review') {
          updates.eligibility = 'pass';
          updates.Eligibility = 'pass';
        }

        setLocalReviewComplete(true);
        await onUpdateRecord(record.id, updates);

        setConfirmReviewOpen(false);
        setReviewCompleteChecked(false);
      }
    } catch (e) {
      console.error('[markReviewComplete] failed', e);
    } finally {
      setSavingReview(false);
    }
  };

  const preScreenRows = useMemo(() => {
    const rows = [
      { label: 'Over 18?', value: getFirstNonEmpty(raw, ['age_verified', 'Age Verified']) },
      {
        label: 'Pregnancy/Nursing?',
        value: getFirstNonEmpty(raw, [
          'pregnant_breastfeeding',
          'pregnant_breastfeedinging',
          'Pregnant/Breastfeeding',
        ]),
      },
      { label: 'Allergies?', value: getFirstNonEmpty(raw, ['allergies_yesno', 'Allergies', 'allergies']) },
      {
        label: 'Allergy details',
        value: getFirstNonEmpty(raw, [
          'allergies_details',
          'Allergies Details',
          'allergy_detail',
          'allergy_details',
          'Allergy Detail',
          'Allergy Details',
          'Allergies (detail)',
        ]),
      },
      { label: 'Booking intent', value: getFirstNonEmpty(raw, ['booking_intent', 'Booking Intent', 'bookingIntent']) },
      {
        label: 'Hesitation reason',
        value: getFirstNonEmpty(raw, [
          'booking_hesitation_reason',
          'Booking Hesitation Reason',
          'bookingHesitationReason',
          'Hesitation Reason',
        ]),
      },
      { label: 'Medications', value: getFirstNonEmpty(raw, ['medications', 'Medications']) },
      { label: 'Medical conditions', value: getFirstNonEmpty(raw, ['conditions', 'Medical Conditions', 'medical_conditions']) },
      {
        label: 'Antibiotics (14d)?',
        value: getFirstNonEmpty(raw, [
          'antibiotics_14d',
          'Antibiotics_14d',
          'Antibiotics 14d',
          'Antibiotics (14d)',
          'Antibiotics (14 days)',
        ]),
      },
    ];

    return rows.filter((r) => r.value !== null && r.value !== undefined && String(r.value).trim() !== '');
  }, [raw]);

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
                <h2 className="text-2xl font-serif font-medium text-slate-900 leading-none mb-3 truncate">{name}</h2>

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

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${eligBadgeClasses(
                        eligibilityUi
                      )}`}
                    >
                      {eligibilityUi}
                    </span>

                    {isUnsuitable && localCleared && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-slate-50 text-slate-700 border-slate-200">
                        Cleared by clinic
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Requested treatment</p>
              <p className="text-sm font-medium text-slate-900 truncate">• {String(treatment)}</p>

              {(bookingIntent || bookingHesitationReason) && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Booking insight</p>

                  <div className="flex flex-wrap gap-2">
                    {bookingIntent && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200 bg-white text-slate-700">
                        {String(bookingIntent)}
                      </span>
                    )}

                    {bookingHesitationReason && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200 bg-white text-slate-700">
                        {String(bookingHesitationReason)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 space-y-4 overflow-auto">
            {showUnsuitableSignals && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-white/60 border-b border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Unsuitable signals</p>
                  <p className="text-xs text-slate-500 mt-0.5">Why the client can’t book right now</p>
                </div>

                <div className="divide-y">
                  {unsuitableSignals.map((s, idx) => (
                    <div key={idx} className="px-4 py-3 flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-sm text-slate-800">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                        No structured reason fields were found on this record. If a client answers Yes or Not sure to
                        pregnancy or allergies then it will appear here.
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
              </div>
            )}

            {showClearancePanel && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-white/60 border-b border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Practitioner action</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isUnsuitable ? 'Clear for future booking if appropriate' : 'Complete review and clear flags'}
                  </p>
                </div>

                <div className="px-4 py-4 bg-white">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      checked={reviewCompleteChecked}
                      onChange={(e) => setReviewCompleteChecked(e.target.checked)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{clearanceTitle}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{clearanceHelper}</p>
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
                    {savingReview ? 'Saving…' : clearanceButtonLabel} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Pre-screen results */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 bg-white/60 border-b border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Pre-screen results</p>
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
          </div>

          {/* Actions */}
          <div className="p-6 pt-4 border-t border-slate-50 bg-white space-y-3">
            <button
              disabled={bookingLocked}
              className={`w-full py-3.5 rounded-xl font-medium text-sm transition-colors shadow-lg flex items-center justify-center gap-2 ${
                bookingLocked
                  ? 'bg-slate-50 text-slate-400 border border-slate-100 shadow-none cursor-not-allowed'
                  : bookingStatus === 'Booked'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-none'
                  : 'bg-[#1a1a1a] text-white hover:bg-black'
              }`}
              onClick={toggleBooking}
              title={
                bookingLocked
                  ? 'This client is currently unsuitable. Clear for future booking to allow manual booking.'
                  : undefined
              }
            >
              {bookingLocked ? (
                <>
                  <AlertTriangle size={18} />
                  Booking locked (clear first)
                </>
              ) : bookingStatus === 'Booked' ? (
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

            {bookingLocked && (
              <p className="text-xs text-slate-500 text-center">
                This client is <strong>unsuitable right now</strong>. If you’re happy to book them in advance, apply the{' '}
                <strong>clinic override</strong> first.
              </p>
            )}

            {mode === 'approved' && <p className="text-xs text-slate-500 text-center">Updating eligibility…</p>}
          </div>
        </div>

        {confirmReviewOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 pointer-events-auto">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setConfirmReviewOpen(false)} />
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Confirm action</p>
                <h3 className="text-lg font-medium text-slate-900 mt-2">
                  {isUnsuitable ? 'Mark as cleared for future booking?' : 'Mark this review as complete?'}
                </h3>
                <p className="text-sm text-slate-600 mt-2">
                  {isUnsuitable
                    ? 'This will apply a clinic override so you can book the client in advance. The eligibility will remain UNSUITABLE (time-based), but booking will be unlocked so you can mark them as Booked.'
                    : 'This will clear the review flag and update the dashboard immediately.'}
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
                  {savingReview ? 'Saving…' : isUnsuitable ? 'Yes, clear' : 'Yes, complete'}
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