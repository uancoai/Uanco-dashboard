import React from 'react';

const PreScreensView = ({
  records = [],
  dropOffs,
  onUpdateRecord,
}: {
  records: any[];
  dropOffs?: any;
  onUpdateRecord?: any;
}) => {
  const getPatientLabel = (r: any) => {
    // Try common Airtable field names first, then fall back safely
    return (
      r.name ||
      r.Name ||
      r['Patient'] ||
      r['Patient Name'] ||
      r['Full Name'] ||
      r['Client Name'] ||
      r.email ||
      r.Email ||
      (r.Id ? `Patient #${r.Id}` : `Record ${String(r.id).slice(-6)}`)
    );
  };

  const getTreatmentLabel = (r: any) => {
    const v =
      r.treatment_selected ||
      r['treatment_selected'] ||
      r['Treatment'] ||
      r['Treatment Selected'] ||
      r['interested_treatments'] ||
      r['Interested Treatments'];

    // If it's an array (common in Airtable multi-select / linked / etc), join it
    if (Array.isArray(v)) return v.filter(Boolean).join(', ');
    return v || '—';
  };

  const getEligibility = (r: any) => {
    const v =
      r.eligibility ||
      r.Eligibility ||
      r['Eligibility'] ||
      r['Eligibility Status'] ||
      r['eligibility_status'];

    return (v ?? 'unknown').toString();
  };

  const eligibilityStyle = (eligRaw: string) => {
    const elig = eligRaw.trim().toLowerCase();
    if (elig === 'pass') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (elig === 'review') return 'bg-amber-50 text-amber-800 border-amber-100';
    if (elig === 'fail') return 'bg-rose-50 text-rose-700 border-rose-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-serif">Patient Records</h2>

      <div className="bg-white border rounded-3xl overflow-hidden shadow-soft">
        <table className="w-full text-left">
          <thead className="bg-uanco-50 border-b">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-uanco-400 uppercase">Patient</th>
              <th className="px-6 py-4 text-xs font-bold text-uanco-400 uppercase">Treatment</th>
              <th className="px-6 py-4 text-xs font-bold text-uanco-400 uppercase">Eligibility</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {records.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-sm text-uanco-500" colSpan={3}>
                  No prescreens found for this clinic yet.
                </td>
              </tr>
            ) : (
              records.map((r: any) => {
                const elig = getEligibility(r);
                return (
                  <tr key={r.id} className="hover:bg-uanco-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{getPatientLabel(r)}</td>
                    <td className="px-6 py-4 text-sm text-uanco-500">{getTreatmentLabel(r)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${eligibilityStyle(
                          elig
                        )}`}
                      >
                        {elig}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreScreensView;
