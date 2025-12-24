import React, { useMemo } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Props = {
  records?: any; // can be [] or { rows: [] } depending on caller
  dropOffs?: any;
  onUpdateRecord?: any;
};

const BUILD_MARK = "PreScreensView v2025-12-24-0300";

function asArray(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.rows)) return input.rows;
  return [];
}

function pickFirst(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function normaliseEligibility(v: any) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  if (s === "pass" || s === "safe" || s === "safe to book") return "Pass";
  if (s === "review" || s === "manual review") return "Review";
  if (s === "fail" || s === "unsuitable") return "Fail";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function PreScreensView({ records }: Props) {
  const arr = asArray(records);

  const rows = useMemo(() => {
    return arr.map((r: any) => {
      const name = pickFirst(r, ["name", "Name", "Patient", "Patient Name", "Full Name"]);
      const email = pickFirst(r, ["email", "Email"]);

      const treatment = pickFirst(r, [
        "treatment_selected",
        "Treatment Selected",
        "Treatment",
        "treatment",
        "interested_treatments",
        "Interested Treatments",
      ]);

      const eligibility = normaliseEligibility(pickFirst(r, ["eligibility", "Eligibility", "Status"]));

      return {
        id: r?.id,
        name: name || email || "(no name)",
        treatment: treatment || "-",
        eligibility: eligibility || "-",
      };
    });
  }, [arr]);

  const badgeClass = (elig: string) => {
    const e = String(elig).toLowerCase();
    if (e === "pass") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (e === "review") return "bg-amber-50 text-amber-800 border-amber-100";
    if (e === "fail") return "bg-rose-50 text-rose-700 border-rose-100";
    return "bg-uanco-50 text-uanco-700 border-uanco-100";
  };

  const iconFor = (elig: string) => {
    const e = String(elig).toLowerCase();
    if (e === "pass") return <CheckCircle2 size={14} className="text-emerald-600" />;
    if (e === "review") return <AlertTriangle size={14} className="text-amber-600" />;
    if (e === "fail") return <XCircle size={14} className="text-rose-600" />;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-3xl font-serif">Patient Records</h2>
        <div className="text-[10px] font-bold uppercase tracking-widest text-uanco-400">
          {BUILD_MARK} · records: {arr.length}
        </div>
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
                <td className="px-6 py-6 text-sm text-uanco-500" colSpan={3}>
                  No prescreens found for this clinic.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-uanco-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium">{r.name}</td>
                  <td className="px-6 py-4 text-sm text-uanco-500">{r.treatment}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badgeClass(
                        r.eligibility
                      )}`}
                    >
                      {iconFor(r.eligibility)}
                      {r.eligibility}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}