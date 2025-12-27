import React, { useMemo, useState } from "react";

type Stat = {
  name: string;
  count: number;
  passRate?: number;
};

type QuestionRow = any;

type Props = {
  stats: Stat[];
  questions?: QuestionRow[];
};

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Very lightweight keyword clustering (no AI calls)
// This gives “themes” from question text.
const THEME_RULES: { label: string; keywords: string[] }[] = [
  { label: "Longevity / Duration", keywords: ["how long", "last", "duration", "weeks", "months"] },
  { label: "Pain / Comfort", keywords: ["hurt", "pain", "numb", "needle"] },
  { label: "Price / Cost", keywords: ["cost", "price", "how much", "£", "pricing"] },
  { label: "Swelling / Bruising / Downtime", keywords: ["swelling", "bruise", "downtime", "recovery"] },
  { label: "Safety / Risks", keywords: ["risk", "safe", "side effect", "complication", "vascular", "occlusion"] },
  { label: "Natural results", keywords: ["natural", "subtle", "overdone", "russian", "migrat"] },
  { label: "Aftercare", keywords: ["aftercare", "avoid", "exercise", "alcohol", "touch", "massage"] },
];

const TreatmentsView: React.FC<Props> = ({ stats = [], questions = [] }) => {
  const [rangeLabel] = useState("Last 30 days"); // placeholder label for now

  const trending = useMemo(() => {
    const sorted = [...stats].sort((a, b) => safeNum(b.count) - safeNum(a.count));
    return sorted.slice(0, 6);
  }, [stats]);

  const questionThemes = useMemo(() => {
    // Pull a “question” field from various possible keys
    const texts = (questions || [])
      .map((q: any) =>
        getFirstNonEmpty(q, [
          "question",
          "Question",
          "prompt",
          "Prompt",
          "client_question",
          "Client Question",
          "text",
          "Text",
        ])
      )
      .filter(Boolean)
      .map((t: any) => String(t));

    if (texts.length === 0) return [];

    const counts: Record<string, number> = {};

    for (const t of texts) {
      const norm = normalizeText(t);

      let matched = false;
      for (const rule of THEME_RULES) {
        if (rule.keywords.some((kw) => norm.includes(normalizeText(kw)))) {
          counts[rule.label] = (counts[rule.label] || 0) + 1;
          matched = true;
        }
      }

      if (!matched) {
        counts["Other"] = (counts["Other"] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [questions]);

  const quickSnapshot = useMemo(() => {
    const totalQuestions = Array.isArray(questions) ? questions.length : 0;

    const top = trending[0];
    const topTreatment = top?.name || "—";
    const topDemand = top ? safeNum(top.count) : 0;

    const avgPassRate =
      stats.length > 0
        ? Math.round(
            stats.reduce((acc, s) => acc + safeNum(s.passRate, 0), 0) / stats.length
          )
        : 0;

    const topTheme = questionThemes[0]?.label || "—";

    return {
      totalQuestions,
      topTreatment,
      topDemand,
      avgPassRate,
      topTheme,
    };
  }, [questions, trending, stats, questionThemes]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-serif">AI Insight</h2>
          <p className="text-[11px] text-uanco-400 mt-1">
            Trends + question themes to guide content and clinic ops.
          </p>
        </div>

        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-uanco-300">
          {rangeLabel}
        </span>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Snapshot */}
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-uanco-300">
            Quick snapshot
          </p>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Questions captured</span>
              <span className="text-sm font-medium">{quickSnapshot.totalQuestions}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Top demand</span>
              <span className="text-sm font-medium">
                {quickSnapshot.topTreatment} <span className="text-uanco-300">({quickSnapshot.topDemand})</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Average pass rate</span>
              <span className="text-sm font-medium">{quickSnapshot.avgPassRate}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-uanco-500">Top question theme</span>
              <span className="text-sm font-medium">{quickSnapshot.topTheme}</span>
            </div>
          </div>
        </div>

        {/* Trending treatments */}
        <div className="bg-white p-6 border rounded-3xl shadow-soft lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-uanco-300">
              Trending treatments
            </p>
            <span className="text-[11px] text-uanco-400">{stats.length} tracked</span>
          </div>

          {trending.length === 0 ? (
            <div className="mt-6 text-sm text-uanco-500">No treatment stats found yet.</div>
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trending.map((s) => (
                <div key={s.name} className="rounded-2xl border border-uanco-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-[11px] text-uanco-400 mt-1">Demand + eligibility</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-medium">{safeNum(s.count)}</p>
                      <p className="text-[11px] text-uanco-400">{safeNum(s.passRate, 0)}% safe</p>
                    </div>
                  </div>

                  {/* Minimal bar (no flashy colors) */}
                  <div className="mt-3 h-2 w-full bg-uanco-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-uanco-900/80 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, safeNum(s.passRate, 0)))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Question themes */}
      <div className="bg-white p-6 border rounded-3xl shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-uanco-300">
              Question themes
            </p>
            <p className="text-[11px] text-uanco-400 mt-1">
              What clients are asking most — useful for captions, FAQs, and consult scripts.
            </p>
          </div>
          <span className="text-[11px] text-uanco-400">{(questions || []).length} questions</span>
        </div>

        {questionThemes.length === 0 ? (
          <div className="mt-6 text-sm text-uanco-500">
            No question text found yet. (Once questions flow in, this will populate automatically.)
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {questionThemes.map((t) => (
              <div key={t.label} className="rounded-2xl border border-uanco-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-sm font-medium">{t.count}</p>
                </div>
                <div className="mt-3 h-2 w-full bg-uanco-50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-uanco-900/80 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((t.count / Math.max(1, (questions || []).length)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-uanco-400">
                  {Math.round((t.count / Math.max(1, (questions || []).length)) * 100)}% of questions
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TreatmentsView;
