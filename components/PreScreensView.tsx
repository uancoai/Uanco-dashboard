import React from 'react';

type Props = {
  records: any[];
  dropOffs?: any[];
  onUpdateRecord?: (id: string, updates: any) => void;
};

function pickFirst(v: any) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function normEligibility(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'pass') return 'Pass';
  if (s === 'fail') return 'Fail';
  if (s === 'review') return 'Review';
  return v ? String(v) : '';
}

const PreScreensView: React.FC<Props> = ({ records = [] }) => {
  // Map Airtable fields -> UI fields (keeps your UI stable even if Airtable names vary)
  const rows = records.map((r: any) => {
    const name =
      r?.Name ??
      r?.name ??
      r?.Patient ??
      r?.patient_name ??
      pickFirst(r?.Patient) ??
      '—';

    const treatment =
      r?.interested_treatments ??
      r?.treatment_selected ??
      r?.Treatment ??
      r?.treatment ??
      pickFirst(r?.Treatments) ??
      '—';

    const eligibility = normEligibility(r?.eligibility ?? r?.Eligibility);

    return {
      id: r?.id,
      name: String(name).trim(),
      treatment: String(treatment).trim(),
      eligibility,
      raw: r,
    };
  });

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
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-uanco-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium">{r.name}</td>
                <td className="px-6 py-4 text-sm text-uanco-500">{r.treatment}</td>
                <td className="px-6 py-4">
                  <span
                    className={[
                      'text-[10px] font-bold uppercase px-2 py-1 rounded-full border',
                      r.eligibility.toLowerCase() === 'pass'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : r.eligibility.toLowerCase() === 'review'
                        ? 'bg-amber-50 text-amber-800 border-amber-100'
                        : r.eligibility.toLowerCase() === 'fail'
                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                        : 'bg-uanco-50 text-uanco-700 border-uanco-100',
                    ].join(' ')}
                  >
                    {r.eligibility || '—'}
                  </span>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td className="px-6 py-10 text-sm text-uanco-400" colSpan={3}>
                  No prescreen records found for this clinic.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreScreensView;
