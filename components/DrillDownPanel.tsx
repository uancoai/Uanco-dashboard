import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, AlertTriangle, CalendarCheck, Phone, Mail } from 'lucide-react';

type Props = {
  record: any;
  prescreen?: any; // optional alias (some callers pass prescreen instead of record)
  onClose: () => void;
  onUpdateRecord?: (id: string, updates: any) => void;
};

function firstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

function toDisplayEligibility(raw: any): 'SAFE' | 'REVIEW' | 'UNSUITABLE' | string {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pass' || s === 'safe') return 'SAFE';
  if (s === 'review') return 'REVIEW';
  if (s === 'fail' || s === 'unsuitable') return 'UNSUITABLE';
  return raw ? String(raw) : '—';
}

function eligibilityStyle(label: string) {
  const s = String(label || '').trim().toLowerCase();
  if (s === 'safe') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  if (s === 'review') return 'bg-amber-50 text-amber-600 border-amber-100';
  if (s === 'unsuitable') return 'bg-rose-50 text-rose-600 border-rose-100';
  return 'bg-slate-50 text-slate-600 border-slate-100';
}

function isYes(v: any) {
  const s = String(v || '').trim().toLowerCase();
  return s === 'yes' || s.startsWith('yes') || s === 'true';
}
function isNo(v: any) {
  const s = String(v || '').trim().toLowerCase();
  return s === 'no' || s.startsWith('no') || s === 'false';
}

function yesNoLabel(v: any) {
  if (isYes(v)) return 'Yes';
  if (isNo(v)) return 'No';
  return v ? String(v) : '—';
}

function yesNoTone(v: any) {
  // Yes = warning tone for risk fields, except age_verified where Yes is good.
  // We'll decide per-row with an override.
  if (isYes(v)) return 'warn';
  if (isNo(v)) return 'ok';
  return 'neutral';
}

const Row = ({
  label,
  value,
  goodWhenYes = false,
  note,
}: {
  label: string;
  value: any;
  goodWhenYes?: boolean;
  note?: string;
}) => {
  const yn = yesNoLabel(value);
  const tone = yesNoTone(value);

  const isGood =
    goodWhenYes ? tone === 'warn' /* yes */ : tone === 'ok' /* no */;

  const isWarn =
    goodWhenYes ? tone === 'ok' /* no */ : tone === 'warn' /* yes */;

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-b-0">
      <div className="text-sm text-slate-600">{label}</div>

      <div className="flex items-center gap-2">
        {note ? <span className="text-[11px] text-slate-400 hidden sm:inline">{note}</span> : null}

        {isGood && (
          <span className="inline-flex items-center gap-1 text-emerald-700 text-sm font-medium">
            <Check size={16} /> {yn}
          </span>
        )}

        {isWarn && (
          <span className="inline-flex items-center gap-1 text-amber-700 text-sm font-medium">
            <AlertTriangle size={16} /> {yn}
          </span>
        )}

        {!isGood && !isWarn && (
          <span className="text-sm font-medium text-slate-700">{yn}</span>
        )}
      </div>
    </div>
  );
};

const DrillDownPanel: React.FC<Props> = ({ record, prescreen, onClose, onUpdateRecord }) => {
  const [mode, setMode] = useState<'default' | 'confirm_approve' | 'approved'>('default');

  const r = prescreen || record;

  useEffect(() => {
    setMode('default');
  }, [r?.id]);

  if (!r) return null;

  const name = firstNonEmpty(r, ['Name', 'name']) || 'Unknown';
  const email = firstNonEmpty(r, ['Email', 'email']) || '';
  const phone = firstNonEmpty(r, ['phone', 'Phone', 'mobile', 'Mobile']) || '';
  const treatment =
    firstNonEmpty(r, ['interested_treatments', 'Interested Treatments', 'treatment_selected', 'Treatment']) || '—';

  const eligibilityRaw = firstNonEmpty(r, ['eligibility', 'Eligibility']);
  const eligibility = toDisplayEligibility(eligibilityRaw);

  const initials = String(name)
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isBooked = String(firstNonEmpty(r, ['booking_status', 'Booking Status']) || '').toLowerCase() === 'booked';

  const toggleBooking = () => {
    if (!onUpdateRecord) return;
    onUpdateRecord(r.id, { booking_status: isBooked ? 'Pending' : 'Booked' });
  };

  const handleApprove = () => {
    if (!onUpdateRecord) return;
    setMode('approved');
    setTimeout(() => {
      // Approve = mark SAFE
      onUpdateRecord(r.id, { eligibility: 'Pass' }); // keep Airtable-friendly value; UI will display SAFE
      setMode('default');
    }, 900);
  };

  // Airtable fields you showed (exact keys)
  const ageVerified = firstNonEmpty(r, ['age_verified']);
  const pregnant = firstNonEmpty(r, ['pregnant_breastfeeding']);
  const allergies = firstNonEmpty(r, ['allergies_yesno']);
  const antibiotics14d = firstNonEmpty(r, ['Antibiotics_14d']);

  const allergiesDetails = firstNonEmpty(r, ['allergies_details', 'Allergies details', 'allergies_detail']);
  const aiSummary = firstNonEmpty(r, ['Pre-screen Summary (AI)', 'pre_screen_summary_ai', 'Pre-screen Summary']);

  const showApproveBlock = String(eligibility).toLowerCase() === 'review';

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="bg-white w-full max-w-md shadow-2xl rounded-3xl overflow-hidden max-h-[88vh] flex flex-col pointer-events-auto ring-1 ring-slate-900/5">
          {/* Header */}
          <div className="p-6 pb-4 relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-300 hover:text-slate-500 transition-colors p-2 rounded-full hover:bg-slate-50"
            >
              <X size={20} />
            </button>

            <div className="flex gap-5 items-start">
              <div className="h-14 w-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 text-lg font-medium tracking-wide shrink-0">
                {initials || '??'}
              </div>

              <div className="flex-1 pt-1 min-w-0 pr-8">
                <h2 className="text-2xl font-serif font-medium text-slate-900 leading-none mb-3 truncate">
                  {name}
                </h2>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-500 min-w-0">
                      <Mail size={14} className="shrink-0" />
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="text-xs font-medium hover:text-slate-800 transition-colors truncate"
                        >
                          {email}
                        </a>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">No email</span>
                      )}
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${eligibilityStyle(
                        eligibility
                      )}`}
                    >
                      {eligibility}
                    </span>
                  </div>

                  {phone ? (
                    <div className="flex items-center gap-2 text-slate-500 min-w-0">
                      <Phone size={14} className="shrink-0" />
                      <a
                        href={`tel:${phone}`}
                        className="text-xs font-medium hover:text-slate-800 transition-colors truncate"
                      >
                        {phone}
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-2 overflow-y-auto">
            {/* Requested Treatment */}
            <div className="mt-2 bg-slate-50/70 border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Requested Treatment
              </p>
              <p className="text-sm font-medium text-slate-900">{String(treatment)}</p>
            </div>

            {/* Pre-screen Results */}
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Pre-screen Results
              </p>

              <div className="bg-white border border-slate-100 rounded-2xl px-4">
                <Row label="Over 18?" value={ageVerified} goodWhenYes={true} />
                <Row label="Pregnancy/Nursing?" value={pregnant} />
                <Row label="Allergies?" value={allergies} note={allergiesDetails ? String(allergiesDetails) : undefined} />
                <Row label="Antibiotics (14 days)?" value={antibiotics14d} />
              </div>
            </div>

            {/* AI Summary */}
            {aiSummary ? (
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  AI Summary
                </p>
                <div className="bg-white border border-slate-100 rounded-2xl p-4">
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                    {String(aiSummary)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer actions */}
          <div className="p-6 pt-4 border-t border-slate-50 bg-white space-y-3">
            {/* SAFE -> booking button */}
            {String(eligibility).toLowerCase() === 'safe' && (
              !isBooked ? (
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
              )
            )}

            {/* REVIEW -> approve flow */}
            {showApproveBlock && mode === 'default' && (
              <button
                className="w-full py-3.5 bg-[#1a1a1a] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors"
                onClick={() => setMode('confirm_approve')}
              >
                Approve Booking
              </button>
            )}

            {showApproveBlock && mode === 'confirm_approve' && (
              <button
                className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                onClick={handleApprove}
              >
                Confirm Approve → SAFE
              </button>
            )}

            {showApproveBlock && mode === 'approved' && (
              <div className="w-full py-3.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-medium text-sm text-center">
                Approved ✅
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DrillDownPanel;