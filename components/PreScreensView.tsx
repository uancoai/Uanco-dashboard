
import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

// Added missing props to fix type mismatch errors when used in App components
const PreScreensView = ({ records, dropOffs, onUpdateRecord }: { records: any, dropOffs?: any, onUpdateRecord?: any }) => {
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
            {records.map(r => (
              <tr key={r.id} className="hover:bg-uanco-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium">{r.name}</td>
                <td className="px-6 py-4 text-sm text-uanco-500">{r.treatment_selected}</td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${r.eligibility === 'Pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                    {r.eligibility}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default PreScreensView;
