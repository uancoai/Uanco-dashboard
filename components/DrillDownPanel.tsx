import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, CalendarCheck, Phone, Mail } from 'lucide-react';

type Props = {
  record: any;
  prescreen?: any;
  onClose: () => void;
  onUpdateRecord?: (id: string, updates: any) => void;
};

function first(obj: any, keys: string[]) {
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

function badgeClasses(label: string) {
  const s = String(label || '').toLowerCase();
  if (s === 'safe') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'review') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}

const DrillDownPanel: React.FC<Props> = ({ record, prescreen, onClose, onUpdateRecord }) => {
  const row = prescreen || record;

  const name = useMemo(() => first(row, ['name', 'Name']) || first(record, ['name', 'Name']) || 'Unnamed', [row, record]);
  const email = useMemo(() => first(row, ['email', 'Email']) || first(record, ['email', 'Email']) || '', [row, record]);
  const phone = useMemo(
    () => first(row, ['phone', 'Phone', 'mobile', 'Mobile']) || first(record, ['phone', 'Phone', 'mobile', 'Mobile']) || '',
    [row, record]
  );

  const eligRaw = useMemo(() => first(row, ['eligibility', 'Eligibility']) || first(record, ['eligibility', 'Eligibility']), [row, record]);
  const eligibilityUi = toUiEligibility(eligRaw);

  // Use either the normalized booking_status (from your PreScreens normalize), or Airtable field names if present
  const bookingRaw =
    first(record, ['booking_status', 'Booking Status']) ??
    first(row, ['booking_status', 'Booking Status']) ??
    'Pending';

  const [bookingStatus, setBookingStatus] = useState<string>(String(bookingRaw));

  useEffect(() => {
    setBookingStatus(String(bookingRaw));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  const initials = name
    ? String(name)
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : '??';

  const isBooked = String(bookingStatus).trim().toLowerCase() === 'booked';

  const toggleBooking = () => {
    const next = isBooked ? 'Pending' : 'Booked';
    setBookingStatus(next); // ✅ instant UI
    onUpdateRecord?.(record.id, { booking_status: next }); // ✅ updates list badge instantly
  };

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

            <div className="flex gap-5 items-start mb-6">
              <div className="h-14 w-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 text-lg font-medium tracking-wide shrink-0">
                {initials}
              </div>

              <div className="flex-1 pt-1 min-w-0 pr-8">
                <h2 className="text-2xl font-serif font-medium text-slate-900 leading-none mb-3 truncate">{name}</h2>

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
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${badgeClasses(
                        eligibilityUi
                      )}`}
                    >
                      {eligibilityUi}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 min-w-0">
                    <Phone size={14} className="shrink-0" />
                    {phone ? (
                      <a href={`tel:${phone}`} className="text-xs font-medium hover:text-slate-800 transition-colors truncate">
                        {phone}
                      </a>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">No phone</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 pt-4 border-t border-slate-50 bg-white space-y-3 pb-safe-area-bottom">
            <button
              className={`w-full py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border transition-colors ${
                isBooked
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                  : 'bg-[#1a1a1a] text-white border-[#1a1a1a] hover:bg-black'
              }`}
              onClick={toggleBooking}
            >
              {isBooked ? <Check size={18} /> : <CalendarCheck size={18} />}
              {isBooked ? 'Booked (click to set Pending)' : 'Mark as Booked'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DrillDownPanel;