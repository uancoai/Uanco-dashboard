import React from 'react';

type Props = {
  records: any[];
  dropOffs?: any[];
  onUpdateRecord?: (id: string, updates: any) => void;
};

function normalizeEligibility(v: any) {
  const s = String(v ?? '').trim();
  if (!s) return 'Unknown';
  // handle Pass/pass/PASS etc
  const lower = s.toLowerCase();
  if (lower === 'pass') return 'Pass';
  if (lower === 'fail') return 'Fail';
  if (lower === 'review') return 'Review';
  return s;
}

function formatTreatments(v: any) {
  if (!v) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

const PreScreensView: React.FC<Props> = ({ records = [] }) => {
  const rows = Array.isArray(records) ? records : [];

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
            {rows.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-sm text-uanco-400" colSpan={3}>
                  No prescreens found for this clinic.
                </td>
              </tr>
            ) : (
              rows.map((r: any) => {
                // Airtable commonly uses Title Case field names
                const patientName = r.Name ?? r.name ?? r.Patient ?? r.patient ?? r.Email ?? r.email ?? '—';

                // you said treatments are stored on PreScreens / DropOffs as "interested_treatments"
                const treatment =
                  formatTreatments(
                    r.interested_treatments ??
                      r['Interested Treatments'] ??
                      r.treatment_selected ??
                      r.Treatment ??
                      r.treatment ??
                      ''
                  ) || '—';

                const eligibility = normalizeEligibility(r.eligibility ?? r.Eligibility);

                const badge =
                  eligibility === 'Pass'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : eligibility === 'Review'
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : eligibility === 'Fail'
                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                        : 'bg-uanco-50 text-uanco-700 border-uanco-100';

                return (
                  <tr key={r.id} className="hover:bg-uanco-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{patientName}</td>
                    <td className="px-6 py-4 text-sm text-uanco-500">{treatment}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badge}`}>
                        {eligibility}
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
