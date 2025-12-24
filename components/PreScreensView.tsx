import React from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Props = {
  records?: any[];
  dropOffs?: any[];
  onUpdateRecord?: (id: string, updates: any) => void;
};

function normElig(v: any) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "pass") return "pass";
  if (s === "fail") return "fail";
  if (s === "review") return "review";
  return "";
}

function firstNonEmpty(row: any, keys: string[]) {
  for (const k of keys) {
    const v = row?.[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    const str = Array.isArray(v) ? v.join(", ") : String(v);
    if (str.trim() !== "") return v;
  }
  return null;
}

export default function PreScreensView({ records }: Props) {
  const rows = Array.isArray(records) ? records : [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-3xl font-serif">Patient Records</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-uanco-400">
          {rows.length} records
        </span>
      </div>

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
                // Airtable field name candidates (supports both your older + newer shapes)
                const patient =
                  firstNonEmpty(r, ["Name", "name", "Patient", "patient_name", "Full Name", "full_name"]) ??
                  firstNonEmpty(r, ["Email", "email"]) ??
                  "Unknown";

                const treatmentRaw =
                  firstNonEmpty(r, [
                    "interested_treatments",
                    "Interested Treatments",
                    "treatment_selected",
                    "Treatment",
                    "treatment",
                  ]) ?? "—";

                const treatment = Array.isArray(treatmentRaw) ? treatmentRaw.join(", ") : String(treatmentRaw);

                const eligRaw = firstNonEmpty(r, ["eligibility", "Eligibility"]) ?? "";
                const elig = normElig(eligRaw);

                const pill =
                  elig === "pass"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : elig === "review"
                    ? "bg-amber-50 text-amber-800 border-amber-100"
                    : elig === "fail"
                    ? "bg-rose-50 text-rose-700 border-rose-100"
                    : "bg-slate-50 text-slate-600 border-slate-100";

                const Icon =
                  elig === "pass" ? CheckCircle2 : elig === "review" ? AlertTriangle : elig === "fail" ? XCircle : null;

                return (
                  <tr key={r.id} className="hover:bg-uanco-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{String(patient)}</td>
                    <td className="px-6 py-4 text-sm text-uanco-500">{treatment}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${pill}`}>
                        {Icon ? <Icon size={14} /> : null}
                        {elig ? elig : String(eligRaw || "unknown")}
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
}