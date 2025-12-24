import React, { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Props = {
  records?: any[];
  dropOffs?: any[];
  onUpdateRecord?: (id: string, updates: any) => void;
};

function normEligibility(v: any): "pass" | "review" | "fail" | "unknown" {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "pass") return "pass";
  if (s === "review") return "review";
  if (s === "fail") return "fail";
  return "unknown";
}

function getName(r: any) {
  return (
    r?.Name ||
    r?.name ||
    r?.Patient ||
    r?.patient ||
    r?.Email ||
    r?.email ||
    "—"
  );
}

function getTreatment(r: any) {
  return (
    r?.["Treatment Selected"] ||
    r?.treatment_selected ||
    r?.Treatment ||
    r?.treatment ||
    r?.["Requested Treatment"] ||
    "—"
  );
}

function badgeForEligibility(e: ReturnType<typeof normEligibility>) {
  if (e === "pass") {
    return {
      text: "PASS",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-100",
      icon: <CheckCircle2 size={14} className="text-emerald-700" />,
    };
  }
  if (e === "review") {
    return {
      text: "REVIEW",
      cls: "bg-amber-50 text-amber-800 border-amber-100",
      icon: <AlertTriangle size={14} className="text-amber-700" />,
    };
  }
  if (e === "fail") {
    return {
      text: "FAIL",
      cls: "bg-rose-50 text-rose-700 border-rose-100",
      icon: <XCircle size={14} className="text-rose-700" />,
    };
  }
  return {
    text: "UNKNOWN",
    cls: "bg-uanco-50 text-uanco-500 border-uanco-100",
    icon: null,
  };
}

const PreScreensView: React.FC<Props> = ({ records = [] }) => {
  const [selected, setSelected] = useState<any | null>(null);
  const [filter, setFilter] = useState<"all" | "pass" | "review" | "fail">("all");

  const rows = useMemo(() => {
    const mapped = (records || []).map((r: any) => {
      const eligibility = normEligibility(r?.eligibility ?? r?.Eligibility);
      return {
        raw: r,
        id: r?.id,
        name: getName(r),
        email: r?.Email || r?.email || "",
        treatment: getTreatment(r),
        eligibility,
      };
    });

    if (filter === "all") return mapped;
    return mapped.filter((x) => x.eligibility === filter);
  }, [records, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-3xl font-serif">Patient Records</h2>

        <div className="flex gap-2">
          {(["all", "pass", "review", "fail"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={[
                "text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl border",
                filter === k
                  ? "bg-uanco-900 text-white border-uanco-900"
                  : "bg-white text-uanco-600 border-uanco-100 hover:bg-uanco-50",
              ].join(" ")}
            >
              {k}
            </button>
          ))}
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
            {rows.map(({ raw, id, name, treatment, eligibility }) => {
              const b = badgeForEligibility(eligibility);
              return (
                <tr
                  key={id}
                  className="hover:bg-uanco-50 transition-colors cursor-pointer"
                  onClick={() => setSelected(raw)}
                >
                  <td className="px-6 py-4 text-sm font-medium">{name}</td>
                  <td className="px-6 py-4 text-sm text-uanco-500">{treatment}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${b.cls}`}>
                      {b.icon}
                      {b.text}
                    </span>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className="px-6 py-10 text-sm text-uanco-500" colSpan={3}>
                  No records match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Simple details modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-soft border border-uanco-100 w-full max-w-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-serif">{getName(selected)}</p>
                <p className="text-xs text-uanco-500 mt-1">{selected?.Email || selected?.email || ""}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl border border-uanco-100 text-uanco-600 hover:bg-uanco-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-uanco-500">Treatment</span>
                <span className="font-medium">{getTreatment(selected)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-uanco-500">Eligibility</span>
                <span className="font-medium">{String(selected?.eligibility ?? selected?.Eligibility ?? "—")}</span>
              </div>
            </div>

            <div className="mt-6 text-[11px] text-uanco-400">
              (This modal is intentionally simple. Once your Airtable schema settles, we can make this match your original “card” perfectly.)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreScreensView;
