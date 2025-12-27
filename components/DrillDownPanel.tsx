import React, { useState, useEffect, useMemo } from 'react';
import { Eligibility } from '../types';
import { X, Check, CalendarCheck, Mail } from 'lucide-react';

/**
 * DrillDownPanel
 * - UX stays the same
 * - Adds a small normalization layer so Airtable field names work
 * - Label mapping: Pass → SAFE, Review → REVIEW, Fail → UNSUITABLE
 */

type Props = {
  record: any;
  onClose: () => void;
  onUpdateRecord: (id: string, updates: any) => void;
};

// Airtable often sends "Yes/No" as strings; ensure "No" is not treated as truthy.
function yesNoToBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;

  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return false;

  // Common “yes” patterns
  if (s === 'yes' || s === "yes, i'm 18 or over" || s === 'true') return true;

  // Common “no” patterns
  if (s === 'no' || s === 'false') return false;

  // If it’s some other text, treat as true only if it clearly indicates yes
  return s.startsWith('yes');
}

function normalizeEligibility(raw: any): 'pass' | 'review' | 'fail' | '' {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return '';

  // Airtable might send "Pass" / "Review" / "Fail"
  if (s === 'pass') return 'pass';
  if (s === 'review') return 'review';
  if (s === 'fail') return 'fail';

  // Some people use "manual review"
  if (s.includes('review')) return 'review';

  // Some people use "unsuitable" as fail
  if (s.includes('unsuitable')) return 'fail';

  return '';
}

function labelForEligibility(norm: 'pass' | 'review' | 'fail' | ''): 'SAFE' | 'REVIEW' | 'UNSUITABLE' | '' {
  if (norm === 'pass') return 'SAFE';
  if (norm === 'review') return 'REVIEW';
  if (norm === 'fail') return 'UNSUITABLE';
  return '';
}

const DrillDownPanel: React.FC<Props> = ({ record, onClose, onUpdateRecord }) => {
  const [mode, setMode] = useState<'default' | 'confirm_approve' | 'approved'>('default');

  useEffect(() => {
    setMode('default');
  }, [record?.id]);

  // ---- Normalize Airtable fields into the shape the UI expects ----
  const r = useMemo(() => {
    if (!record) return null;

    const name = record.Name ?? record.name ?? '';
    const email = record.Email ?? record.email ?? '';
    const eligibilityRaw = record.eligibility ?? record.Eligibility ?? record['Eligibility'] ?? '';
    const eligibilityNorm = normalizeEligibility(eligibilityRaw);

    const booking_status = record.booking_status ?? record['booking_status'] ?? record['Booking Status'] ?? record.bookingStatus;

    // Health / screening fields (Airtable names may vary)
    const allergiesYesNo = record.allergies_yesno ?? record.Allergies_yesno ?? record['allergies_yesno'] ?? record['Allergies?'];
    const allergiesDetails =
      record.allergies_details ?? record.Allergies_details ?? record['allergies_details'] ?? record['Allergies Details'];

    const antibiotics14d = record.Antibiotics_14d ?? record.antibiotics_14d ?? record['Antibiotics_14d'] ?? record['antibiotics_14d'];
    const pregnantBreastfeeding =
      record.pregnant_breastfeeding ?? record.Pregnant_breastfeeding ?? record['pregnant_breastfeeding'] ?? record['Pregnant/Breastfeeding'];

    const treatmentSelected =
      record.treatment_selected ??
      record.Treatment ??
      record['treatment_selected'] ??
      record['Treatment Selected'] ??
      record.interested_treatments ??
      record['interested_treatments'] ??
      '';

    // Convert Yes/No strings safely
    const allergiesFlag = yesNoToBool(allergiesYesNo);
    const antibioticsFlag = yesNoToBool(antibiotics14d);
    const pregnantFlag = yesNoToBool(pregnantBreastfeeding);

    // AI summary (if you want to display later)
    const aiSummary =
      record['Pre-screen Summary (AI)'] ??
      record['Pre-screen Summary'] ??
      record.pre_screen_summary ??
      record.preScreenSummary ??
      '';

    return {
      ...record,
      // normalized keys used by the UI
      name,
      email,
      eligibilityNorm, // 'pass' | 'review' | 'fail'
      eligibilityLabel: labelForEligibility(eligibilityNorm), // SAFE / REVIEW / UNSUITABLE
      booking_status: booking_status ?? 'Pending',
      treatment_selected: treatmentSelected,
      allergies_yesno: allergiesFlag,
      allergies_details: allergiesDetails,
      antibiotics_14d: antibioticsFlag,
      pregnant_breastfeeding: pregnantFlag,
      aiSummary,
    };
  }, [record]);

  if (!r) return null;

  const initials = r.name
    ? String(r.name)
        .split(' ')
        .filter(Boolean)
        .map((n: string) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : '??';

  // Keep Eligibility enum compatibility, but base all logic on normalized eligibility
  const isPass = r.eligibilityNorm === 'pass' || r.eligibility === Eligibility.PASS;
  const isReview = r.eligibilityNorm === 'review' || r.eligibility === Eligibility.REVIEW;
  const isFail = r.eligibilityNorm === 'fail' || r.eligibility === Eligibility.FAIL;

  const isBooked = String(r.booking_status || '').toLowerCase() === 'booked';

  const toggleBooking = () => {
    onUpdateRecord(r.id, { booking_status: isBooked ? 'Pending' : 'Booked' });
  };

  const handleApprove = () => {
    setMode('approved');
    setTimeout(() => {
      // update eligibility as "Pass" since Airtable currently stores strings like "Pass"
      onUpdateRecord(r.id, { eligibility: 'Pass' });
    }, 2500);
  };

  const getWarningContent = () => {
    if (r.allergies_yesno) return r.allergies_details || 'Allergies detected';
    if (r.antibiotics_14d) return 'Client indicated use of antibiotics in the last 14 days.';
    if (r.pregnant_breastfeeding) return 'Client indicated pregnancy or breastfeeding.';
    return r.reason;
  };

  const warningContent = getWarningContent();

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] transition-opacity" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="bg-white w-full max-w-md shadow-2xl rounded-3xl overflow-hidden max-h-[85vh] flex flex-col pointer-events-auto ring-1 ring-slate-900/5 transform transition-all">
          <div className="p-6 pb-4 relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-300 hover:text-slate-500 transition-colors p-2 rounded-full hover:bg-slate-50"
            >
              <X size={20} />
            </button>

            <div className="flex gap-5 items-start mb-6">
              <div className="h-14 w-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 text-lg font-medium tracking-wide shrink-0">
                {initials}
              </div>

              <div className="flex-1 pt-1 min-w-0 pr-8">
                <h2 className="text-2xl font-serif font-medium text-slate-900 leading-none mb-3">{r.name || 'Unknown'}</h2>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-500 min-w-0">
                      <Mail size={14} className="shrink-0" />
                      {r.email ? (
                        <a
                          href={`mailto:${r.email}`}
                          className="text-xs font-medium hover:text-slate-800 transition-colors truncate"
                        >
                          {r.email}
                        </a>
                      ) : (
                        <span className="text-xs font-medium truncate">No email</span>
                      )}
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                        isPass
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : isFail
                          ? 'bg-rose-50 text-rose-600 border-rose-100'
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}
                    >
                      {r.eligibilityLabel || (r.eligibility ? String(r.eligibility) : '')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional: if you want a small treatment line shown without redesign */}
            {/* <div className="text-xs text-slate-500">{r.treatment_selected}</div> */}
          </div>

          <div className="p-6 pt-4 border-t border-slate-50 bg-white space-y-3 pb-safe-area-bottom">
            {isPass &&
              (!isBooked ? (
                <button
                  className="w-full py-3.5 bg-[#1a1a1a] text-white rounded-xl font-medium text-sm hover:bg-black transition-colors shadow-lg"
                  onClick={toggleBooking}
                >
                  <CalendarCheck size={18} className="inline mr-2" />
                  Mark as Booked
                </button>
              ) : (
                <button
                  className="w-full py-3.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
                  onClick={toggleBooking}
                >
                  <Check size={18} />
                  Booked Successfully
                </button>
              ))}

            {isReview && mode === 'default' && (
              <button
                className="w-full py-3.5 bg-[#1a1a1a] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors"
                onClick={() => setMode('confirm_approve')}
              >
                Approve Booking
              </button>
            )}

            {isReview && mode === 'confirm_approve' && (
              <button
                className="w-full py-3.5 bg-[#1a1a1a] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors"
                onClick={handleApprove}
              >
                Confirm Approve
              </button>
            )}

            {/* If you later want to render warningContent or AI summary, we can add it without changing UX */}
            {/* {warningContent ? <div className="text-xs text-slate-600">{warningContent}</div> : null} */}
          </div>
        </div>
      </div>
    </>
  );
};

export default DrillDownPanel;
