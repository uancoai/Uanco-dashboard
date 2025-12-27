import React, { useMemo } from "react";

type Props = {
  stats: any[];        // keep existing prop so nothing else breaks
  questions?: any[];   // raw questions coming from dashboardData.questions
};

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function normalizeQuestionText(q: any): string {
  const text =
    getFirstNonEmpty(q, [
      "question",
      "Question",
      "text",
      "Text",
      "message",
      "Message",
      "content",
      "Content",
      "Prompt",
    ]) ?? "";

  return String(text).trim();
}

type Bucket = "Longevity" | "Results & expectations" | "Pain & comfort" | "Other";

function bucketQuestion(textRaw: string): Bucket {
  const t = textRaw.toLowerCase();

  // Pain & comfort
  if (
    /\b(hurt|hurts|pain|painful|sore|sting|stings|numb|numbing|anaesthetic|anesthetic|comfort)\b/.test(t)
  ) {
    return "Pain & comfort";
  }

  // Longevity
  if (
    /\b(how long|last|lasting|longevity|duration|weeks?|months?|days?)\b/.test(t)
  ) {
    return "Longevity";
  }

  // Results & expectations
  if (
    /\b(result|results|expect|expectation|natural|look like|before|after|swelling|bruis|heal|healing|downtime|side effect|risk)\b/.test(t)
  ) {
    return "Results & expectations";
  }

  return "Other";
}

const TreatmentsView: React.FC<Props> = ({ stats, questions = [] }) => {
  const insight = useMemo(() => {
    const counts: Record<Bucket, number> = {
      "Longevity": 0,
      "Results & expectations": 0,
      "Pain & comfort": 0,
      "Other": 0,
    };

    let total = 0;

    for (const q of questions) {
      const text = normalizeQuestionText(q);
      if (!text) continue;
      total += 1;
      counts[bucketQuestion(text)] += 1;
    }

    const rows = (Object.keys(counts) as Bucket[])
      .map((k) => ({ label: k, count: counts[k] }))
      .sort((a, b) => b.count - a.count);

    return { total, rows };
  }, [questions]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-serif">AI Insight</h2>
        <p className="text-[11px] text-uanco-400 mt-2">
          v1 uses simple keyword grouping from the questions logged (no guesses).
        </p>
      </div>

      {/* Block 1: What clients ask */}
      <div className="bg-white p-6 border rounded-3xl shadow-soft">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">What clients ask before booking</h3>
          <span className="text-[11px] font-bold uppercase tracking-widest text-uanco-400">
            {insight.total} questions
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {insight.total === 0 ? (
            <p className="text-sm text-uanco-500">
              No questions captured yet. Once clients ask questions during the pre-screen, you’ll see patterns here.
            </p>
          ) : (
            insight.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-sm text-uanco-600">{r.label}</span>
                <span className="text-sm font-medium text-uanco-900">{r.count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Keep existing stats block if you still want it visible (optional) */}
      {Array.isArray(stats) && stats.length > 0 && (
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <h3 className="text-lg font-medium">Treatment interest (v1)</h3>
          <p className="text-[11px] text-uanco-400 mt-1">
            Based on what clients selected as interested (not confirmed bookings).
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.map((s: any, idx: number) => {
              const name = s?.treatment ?? s?.name ?? `Treatment ${idx + 1}`;
              const count = s?.count ?? 0;
              return (
                <div key={String(name)} className="bg-uanco-50 border border-uanco-100 rounded-3xl p-5">
                  <p className="text-sm font-medium text-uanco-900">{name}</p>
                  <p className="text-[12px] text-uanco-500 mt-2">Interest</p>
                  <p className="text-2xl font-light text-uanco-900 mt-1">{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TreatmentsView;