import React from "react";

type Props = {
  records: any[];
  failReasons: any[];
  onUpdateRecord?: (id: string, updates: any) => void;
};

const ComplianceView: React.FC<Props> = ({ records = [], failReasons = [], onUpdateRecord }) => {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-serif">Compliance & Safety</h2>

      {/* ✅ TEMP DEBUG LINE (safe to remove later) */}
      <p className="text-[11px] text-uanco-400">
        Debug: records={records?.length ?? 0} • failReasons={failReasons?.length ?? 0}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Contraindications */}
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <h3 className="font-bold mb-4">Top Contraindications</h3>

          {(!failReasons || failReasons.length === 0) ? (
            <p className="text-uanco-400 text-sm">No contraindication data yet.</p>
          ) : (
            failReasons.map((f: any, idx: number) => {
              const reason = f?.reason ?? `Reason ${idx + 1}`;
              const count = Number(f?.count ?? 0);

              // simple width cap so it doesn’t overflow / look weird
              const widthPct = Math.min(100, Math.max(0, count * 10));

              return (
                <div key={`${reason}-${idx}`} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{reason}</span>
                    <span>{count}</span>
                  </div>

                  <div className="bg-uanco-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Flagged for Review */}
        <div className="lg:col-span-2 bg-white border rounded-3xl p-6 shadow-soft">
          <h3 className="font-bold mb-4">Flagged for Review</h3>
          <p className="text-uanco-400 text-sm">
            All medical flags are summarized for practitioner review.
          </p>

          {/* (Optional) later we can render real flagged rows from records */}
        </div>
      </div>
    </div>
  );
};

export default ComplianceView;
