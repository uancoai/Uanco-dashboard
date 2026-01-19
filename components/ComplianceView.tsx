import React, { useMemo, useState } from "react";
import DrillDownPanel from "./DrillDownPanel";

type Props = {
  records: any[];
  failReasons: any[];
  onUpdateRecord?: (id: string, updates: any) => void;
};

function toLower(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const direct = obj?.[k];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") return direct;

    const nested = obj?.fields?.[k];
    if (nested !== undefined && nested !== null && String(nested).trim() !== "") return nested;
  }
  return null;
}

function isTruthy(v: any) {
  const s = toLower(v);
  return v === true || s === "true" || s === "yes" || s === "1" || s === "y";
}

// ✅ Review override logic: flagged-for-review wins unless review marked complete
function isManualReview(rec: any) {
  const reviewComplete = getFirstNonEmpty(rec, ["Review Complete", "review_complete", "reviewComplete"]);
  if (isTruthy(reviewComplete)) return false;

  const e = toLower(getFirstNonEmpty(rec, ["eligibility", "Eligibility"]));
  if (e === "review") return true;

  const explicitFlag = getFirstNonEmpty(rec, [
    "Flagged for Review",
    "flagged_for_review",
    "manual_review",
    "Manual Review",
    "manual_review_flag",
    "manual_review_required",
    "review_flag",
    "Review Flag",
    "flagged",
    "Flagged",
  ]);

  return isTruthy(explicitFlag);
}

// ✅ Inferred review triggers (even if manual_review_flag wasn't set)
function hasReviewTriggers(rec: any) {
  // If review already completed, do not treat anything as a live trigger
  const reviewComplete = getFirstNonEmpty(rec, ["Review Complete", "review_complete", "reviewComplete"]);
  if (isTruthy(reviewComplete)) return false;

  // Pregnancy/Breastfeeding: Yes OR Not sure
  const preg = getFirstNonEmpty(rec, [
    "pregnant_breastfeeding",
    "Pregnant/Breastfeeding",
    "Pregnant Breastfeeding",
    "pregnant_breastfeed",
    "pregnancy",
  ]);
  const p = toLower(preg);
  const pregTrigger = p === "yes" || p === "true" || p === "not sure" || p === "unsure" || p === "maybe";

  // Allergies: Yes only
  const allergies = getFirstNonEmpty(rec, ["allergies_yesno", "allergies", "Allergies"]);
  const a = toLower(allergies);
  const allergyTrigger = a === "yes" || a === "true";

  // Antibiotics in last 14 days: Yes only
  const abx = getFirstNonEmpty(rec, [
    "antibiotics_14d",
    "Antibiotics_14d",
    "Antibiotics 14d",
    "Antibiotics (14d)",
    "Antibiotics (14 days)",
  ]);
  const abxVal = toLower(abx);
  const abxTrigger = abxVal === "yes" || abxVal === "true";

  return pregTrigger || allergyTrigger || abxTrigger;
}

function toUiEligibility(rec: any): "SAFE" | "REVIEW" | "UNSUITABLE" | "—" {
  const raw = getFirstNonEmpty(rec, ["eligibility", "Eligibility"]);
  const s = toLower(raw);

  // Hard stop always wins
  if (s === "fail" || s === "unsuitable") return "UNSUITABLE";

  // Explicit review values
  if (s === "review" || s === "manual review") return "REVIEW";

  // Inferred/flag-based review
  if (isManualReview(rec) || hasReviewTriggers(rec)) return "REVIEW";

  // Safe
  if (s === "pass" || s === "safe") return "SAFE";

  return raw ? (String(raw).toUpperCase() as any) : "—";
}

function badgeClasses(label: string) {
  const s = toLower(label);
  if (s === "safe") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (s === "review") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-rose-50 text-rose-700 border-rose-100";
}

function parseDateMaybe(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatShortDate(d: Date | null) {
  if (!d) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRecordTs(r: any) {
  return (
    getFirstNonEmpty(r, [
      "Auto Created Time",
      "auto_created_time",
      "created_time",
      "Created time",
      "Created Time",
      "webhook_timestamp",
      "Webhook Timestamp",
      "created_at",
      "submitted_at",
      "Submitted At",
    ]) ?? null
  );
}

function getDisplayName(r: any) {
  return getFirstNonEmpty(r, ["Name", "name"]) || "Unnamed";
}

function getTreatment(r: any) {
  return (
    getFirstNonEmpty(r, [
      "interested_treatments",
      "Interested Treatments",
      "treatment_selected",
      "Treatment",
    ]) ||
    "—"
  );
}

function buildReviewSignals(r: any) {
  // Pull the “detail” fields you care about, but only include if they have content.
  const pairs: Array<{ label: string; value: any }> = [];

  const allergy = getFirstNonEmpty(r, ["allergies_details", "Allergies Details", "Allergies", "allergies"]);
  if (allergy) pairs.push({ label: "Allergy", value: allergy });

  const meds = getFirstNonEmpty(r, ["medications_details", "Medications Details", "Medications", "medications"]);
  if (meds) pairs.push({ label: "Meds", value: meds });

  const pregnancy = getFirstNonEmpty(r, ["pregnancy_details", "Pregnancy Details", "pregnancy"]);
  if (pregnancy) pairs.push({ label: "Pregnancy", value: pregnancy });

  const conditions = getFirstNonEmpty(r, [
    "medical_conditions_details",
    "Medical Conditions Details",
    "medical_conditions",
    "Medical Conditions",
  ]);
  if (conditions) pairs.push({ label: "Condition", value: conditions });

  // If nothing explicit, fall back to the reason field (if your backend provides it)
  if (pairs.length === 0) {
    const reason = getFirstNonEmpty(r, ["fail_reason", "Fail Reason", "review_reason", "Review Reason", "reason"]);
    if (reason) pairs.push({ label: "Note", value: reason });
  }

  return pairs;
}

const ComplianceView: React.FC<Props> = ({ records = [], failReasons = [], onUpdateRecord }) => {
  const [selected, setSelected] = useState<any | null>(null);

  const sorted = useMemo(() => {
    const copy = [...records];
    copy.sort((a, b) => {
      const da = parseDateMaybe(getRecordTs(a));
      const db = parseDateMaybe(getRecordTs(b));
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });
    return copy;
  }, [records]);

  const flagged = useMemo(() => {
    return sorted.filter((r) => toUiEligibility(r) === "REVIEW");
  }, [sorted]);

  const unsuitable = useMemo(() => {
    return sorted.filter((r) => toUiEligibility(r) === "UNSUITABLE");
  }, [sorted]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h2 className="text-3xl font-serif">Compliance & Safety</h2>
        <div className="text-[10px] font-bold uppercase tracking-widest text-uanco-400">
          Review: {flagged.length} • Unsuitable: {unsuitable.length}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Contraindications */}
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <h3 className="font-bold mb-4">Top Contraindications</h3>

          {!failReasons || failReasons.length === 0 ? (
            <p className="text-uanco-400 text-sm">No contraindication data yet.</p>
          ) : (
            failReasons.map((f: any, idx: number) => {
              const reason = f?.reason ?? `Reason ${idx + 1}`;
              const count = Number(f?.count ?? 0);
              const widthPct = Math.min(100, Math.max(0, count * 10));

              return (
                <div key={`${reason}-${idx}`} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{reason}</span>
                    <span>{count}</span>
                  </div>

                  <div className="bg-uanco-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full" style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Flagged for Review */}
        <div className="lg:col-span-2 bg-white border rounded-3xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold">Flagged for Review</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-uanco-400">
              {flagged.length} flagged
            </span>
          </div>
          <p className="text-uanco-400 text-sm mb-4">Tap a row to open the full pre-screen + review actions.</p>

          {flagged.length === 0 ? (
            <div className="text-sm text-uanco-500">No clients currently flagged for review.</div>
          ) : (
            <div className="divide-y rounded-2xl border border-uanco-100 overflow-hidden">
              {flagged.slice(0, 10).map((r: any) => {
                const ts = parseDateMaybe(getRecordTs(r));
                const signals = buildReviewSignals(r);

                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="w-full text-left px-5 py-4 hover:bg-uanco-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-medium truncate">{getDisplayName(r)}</p>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badgeClasses(
                              "REVIEW"
                            )}`}
                          >
                            REVIEW
                          </span>
                        </div>
                        <p className="text-[12px] text-uanco-500 truncate">{String(getTreatment(r))}</p>

                        {signals.length > 0 && (
                          <p className="text-[12px] text-uanco-500 mt-1 truncate">
                            {signals
                              .slice(0, 2)
                              .map((p) => `${p.label}: ${String(p.value)}`)
                              .join(" • ")}
                          </p>
                        )}
                      </div>

                      <div className="text-[11px] text-uanco-400 whitespace-nowrap">{formatShortDate(ts)}</div>
                    </div>
                  </button>
                );
              })}

              {flagged.length > 10 && (
                <div className="px-5 py-3 text-[11px] text-uanco-400 bg-white/60">
                  Showing 10 of {flagged.length}. Use Pre-Screens for the full list.
                </div>
              )}
            </div>
          )}

          {unsuitable.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold">Unsuitable</h4>
                <span className="text-[10px] font-bold uppercase tracking-widest text-uanco-400">
                  {unsuitable.length} unsuitable
                </span>
              </div>

              <div className="divide-y rounded-2xl border border-uanco-100 overflow-hidden">
                {unsuitable.slice(0, 5).map((r: any) => {
                  const ts = parseDateMaybe(getRecordTs(r));
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="w-full text-left px-5 py-4 hover:bg-uanco-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-medium truncate">{getDisplayName(r)}</p>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badgeClasses(
                                "UNSUITABLE"
                              )}`}
                            >
                              UNSUITABLE
                            </span>
                          </div>
                          <p className="text-[12px] text-uanco-500 truncate">{String(getTreatment(r))}</p>
                        </div>
                        <div className="text-[11px] text-uanco-400 whitespace-nowrap">{formatShortDate(ts)}</div>
                      </div>
                    </button>
                  );
                })}

                {unsuitable.length > 5 && (
                  <div className="px-5 py-3 text-[11px] text-uanco-400 bg-white/60">
                    Showing 5 of {unsuitable.length}. Use Pre-Screens for the full list.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drilldown */}
      {selected && (
        <DrillDownPanel
          record={selected}
          prescreen={selected}
          onClose={() => setSelected(null)}
          onUpdateRecord={onUpdateRecord}
        />
      )}
    </div>
  );
};

export default ComplianceView;
