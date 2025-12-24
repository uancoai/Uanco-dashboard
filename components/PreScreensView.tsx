import React, { useMemo } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Props = {
  records: any[];
  dropOffs?: any[];
  onUpdateRecord?: (id: string, updates: any) => void;
};

function normalizeEligibility(v: any) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "pass") return "Pass";
  if (s === "fail") return "Fail";
  if (s === "review") return "Review";
  if (!s) return "Unknown";
  // If Airtable returns something unexpected, still show it
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function eligibilityBadge(elig: string) {
  const e = elig.toLowerCase();

  if (e === "pass") {
    return {
      icon: <CheckCircle2 size={14} />,
      cls: "bg-emerald-50 text-emerald-700 border-emerald-100",
    };
  }

  if (e === "review") {
    return {
      icon: <AlertTriangle size={14} />,
      cls: "bg-amber-50 text-amber-700 border-amber-100",
    };
  }

  return {
    icon: <XCircle size={14} />,
    cls: "bg-rose-50 text-rose-700 border-rose-100",
  };
}

const PreScreensView: React.FC<Props> = ({ records }) => {
  const rows = useMemo(() => {
    const safe = Array.isArray(records) ? records : [];

    return safe.map((r) => {
      const patient =
        r.Name ||
        r.name ||
        r.Patient ||
        r.patient ||
        r.Email ||
        r.email ||
        "—";

      const treatment =
        r["Treatment Selected"] ||
        r["Treatment"] ||
        r.treatment_selected ||
        r.treatment ||
        "—";

      const eligibility = normalizeEligibility(r.eligibility || r.Eligibility);

      return {
        id: r.id,
        patient,
        treatment,
        eligibility,
      };
    });
  }, [records]);

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
                <td className="px-6 py-6 text-sm text-uanco-500" colSpan={3}>
                  No prescreens found for this clinic.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const badge = eligibilityBadge(r.eligibility);
                return (
                  <tr key={r.id} className="hover:bg-uanco-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{r.patient}</td>
                    <td className="px-6 py-4 text-sm text-uanco-500">{r.treatment}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badge.cls}`}>
                        {badge.icon}
                        {r.eligibility}
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
