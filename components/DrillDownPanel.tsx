import React, { useState, useEffect } from 'react';
import { Eligibility } from '../types';
import { X, Check, AlertTriangle, CalendarCheck, Phone, Mail, ChevronLeft, CheckCircle2 } from 'lucide-react';

const DrillDownPanel = ({ record, onClose, onUpdateRecord }) => {
  const [mode, setMode] = useState('default');

  useEffect(() => {
    setMode('default');
  }, [record?.id]);

  if (!record) return null;

  const initials = record.name
    ? record.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '??';

  const isPass = record.eligibility === Eligibility.PASS;
  const isReview = record.eligibility === Eligibility.REVIEW;
  const isFail = record.eligibility === Eligibility.FAIL;
  
  const isBooked = record.booking_status === 'Booked';

  const toggleBooking = () => {
    onUpdateRecord(record.id, { booking_status: isBooked ? 'Pending' : 'Booked' });
  };

  const handleApprove = () => {
      setMode('approved');
      setTimeout(() => {
          onUpdateRecord(record.id, { eligibility: Eligibility.PASS });
      }, 2500);
  };
  
  const getWarningContent = () => {
      if (record.allergies_yesno) return record.allergies_details || "Allergies detected";
      if (record.antibiotics_14d) return "Client indicated use of antibiotics in the last 14 days.";
      if (record.pregnant_breastfeeding) return "Client indicated pregnancy or breastfeeding.";
      return record.reason;
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
                    <h2 className="text-2xl font-serif font-medium text-slate-900 leading-none mb-3">{record.name}</h2>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-slate-500 min-w-0">
                                <Mail size={14} className="shrink-0" />
                                <a href={`mailto:${record.email}`} className="text-xs font-medium hover:text-slate-800 transition-colors truncate">
                                    {record.email}
                                </a>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                                isPass ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                isFail ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                                {record.eligibility}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          <div className="p-6 pt-4 border-t border-slate-50 bg-white space-y-3 pb-safe-area-bottom">
              {isPass && (
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

              {isReview && mode === 'default' && (
                  <>
                      <button 
                          className="w-full py-3.5 bg-[#1a1a1a] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors"
                          onClick={() => setMode('confirm_approve')}
                      >
                          Approve Booking
                      </button>
                  </>
              )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DrillDownPanel;
