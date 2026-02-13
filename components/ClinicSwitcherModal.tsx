import React, { useMemo, useState } from 'react';
import type { ClinicSwitcherOption } from '../lib/api';
import { Search, X } from 'lucide-react';

type Props = {
  isOpen: boolean;
  clinics: ClinicSwitcherOption[];
  currentClinicId: string;
  currentClinicName?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSelect: (clinicId: string) => void;
};

const ClinicSwitcherModal: React.FC<Props> = ({
  isOpen,
  clinics,
  currentClinicId,
  currentClinicName,
  loading = false,
  error = null,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('');

  const filteredClinics = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter((clinic) => String(clinic.name || '').toLowerCase().includes(q));
  }, [clinics, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        className="absolute inset-0 bg-black/40"
        aria-label="Close clinic switcher"
        onClick={onClose}
      />
      <div className="relative z-[71] mx-auto mt-16 w-[94vw] max-w-2xl rounded-2xl border border-uanco-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-uanco-100 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-uanco-400">Admin</p>
            <h2 className="text-sm font-semibold text-uanco-900">Switch clinic</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-uanco-100 p-1.5 text-uanco-500 hover:bg-uanco-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative mb-3">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-uanco-300" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clinics..."
              className="w-full rounded-xl border border-uanco-200 bg-white py-2 pl-9 pr-3 text-sm text-uanco-900 outline-none focus:border-uanco-300 focus:ring-2 focus:ring-uanco-100"
            />
          </div>

          {loading && <p className="text-xs text-uanco-400">Loading clinics…</p>}
          {error && <p className="text-xs text-rose-600">{error}</p>}

          {!loading && !error && (
            <div className="max-h-[55vh] space-y-2 overflow-auto pr-1">
              {currentClinicId &&
                !clinics.some((c) => c.airtable_clinic_record_id === currentClinicId) && (
                  <button
                    onClick={() => {
                      onSelect(currentClinicId);
                      onClose();
                    }}
                    className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-left"
                  >
                    <p className="text-xs font-semibold text-amber-900">{currentClinicName || 'Current clinic'}</p>
                    <p className="text-[11px] text-amber-800">{currentClinicId}</p>
                  </button>
                )}

              {filteredClinics.length === 0 && <p className="text-xs text-uanco-400">No clinics found.</p>}

              {filteredClinics.map((clinic) => {
                const isActive = clinic.airtable_clinic_record_id === currentClinicId;
                return (
                  <button
                    key={clinic.airtable_clinic_record_id}
                    onClick={() => {
                      onSelect(clinic.airtable_clinic_record_id);
                      onClose();
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      isActive
                        ? 'border-uanco-900 bg-uanco-900 text-white'
                        : 'border-uanco-100 bg-white text-uanco-900 hover:bg-uanco-50'
                    }`}
                  >
                    <p className="text-xs font-semibold">{clinic.name}</p>
                    <p className={`text-[11px] ${isActive ? 'text-uanco-200' : 'text-uanco-400'}`}>
                      {clinic.airtable_clinic_record_id}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicSwitcherModal;

