import React, { useMemo } from "react";

type Props = {
  // dashboard passes these in already
  preScreens?: any[];
  questions?: any[];
  metrics?: any;
};

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function parseDateMaybe(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toUiEligibility(raw: any): "SAFE" | "REVIEW" | "UNSUITABLE" | "—" {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "pass") return "SAFE";
  if (s === "review") return "REVIEW";
  if (s === "fail") return "UNSUITABLE";
  if (s === "safe") return "SAFE";
  if (s === "unsuitable") return "UNSUITABLE";
  return raw ? (String(raw).toUpperCase() as any) : "—";
}

// Basic, non-hallucinated "theme" bucketing (v1)
// Later we can upgrade this with AI categorisation at ingest time.
function guessTheme(q: string) {
  const s = q.toLowerCase();
  if (/(hurt|pain|painful|numb|needle)/.test(s)) return "Pain / comfort";
  if (/(last|long|duration|how long)/.test(s)) return "Longevity";
  if (/(risk|safe|danger|side effect|complication)/.test(s)) return "Safety / risks";
  if (/(swelling|bruise|downtime|recovery|aftercare)/.test(s)) return "Downtime / aftercare";
  if (/(price|cost|£|\$|how much)/.test(s)) return "Price";
  if (/(natural|look|result|before after|size)/.test(s)) return "Results / expectations";
  return "Other";
}

const TreatmentsView: React.FC<Props> = ({ preScreens = [], questions = [], metrics }) => {
  // ---------- 90 day window (fallback: if timestamps missing, include all) ----------
  const { filteredQuestions, windowLabel } = useMemo(() => {
    const NOW = Date.now();
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

    // try a few common timestamp fields for questions
    const tsKeys = ["created_at", "Created", "Created Time", "timestamp", "webhook_timestamp", "Webhook Timestamp"];

    // if we can't parse timestamps reliably, don't pretend we can filter
    let parsedCount = 0;

    const withTs = questions.map((q) => {
      const rawTs = getFirstNonEmpty(q, tsKeys);
      const d = parseDateMaybe(rawTs);
      if (d) parsedCount += 1;
      return { q, d };
    });

    // if very few have timestamps, include all
    if (parsedCount < Math.min(5, Math.ceil(questions.length * 0.25))) {
      return { filteredQuestions: questions, windowLabel: "All-time" };
    }

    const cutoff = NOW - NINETY_DAYS_MS;
    const filtered = withTs
      .filter(({ d }) => (d ? d.getTime() >= cutoff : false))
      .map(({ q }) => q);

    return { filteredQuestions: filtered, windowLabel: "Last 90 days" };
  }, [questions]);

  // ---------- Block 1: Common Questions ----------
  const topQuestionThemes = useMemo(() => {
    const textKeys = ["question", "Question", "message", "Message", "text", "Text"];

    const counts = new Map<string, number>();

    for (const row of filteredQuestions) {
      const raw = getFirstNonEmpty(row, textKeys);
      const q = String(raw || "").trim();
      if (!q) continue;

      const theme = guessTheme(q);
      counts.set(theme, (counts.get(theme) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [filteredQuestions]);

  // ---------- Block 2: Booking Friction ----------
  const bookingFriction = useMemo(() => {
    const eligKeys = ["eligibility", "Eligibility"];
    const reasonKeys = ["fail_reason", "Fail Reason", "Reason", "reason"];

    let reviewCount = 0;
    const reasonCounts = new Map<string, number>();

    for (const r of preScreens) {
      const eligUi = toUiEligibility(getFirstNonEmpty(r, eligKeys));
      if (eligUi !== "REVIEW" && eligUi !== "UNSUITABLE") continue;

      if (eligUi === "REVIEW") reviewCount += 1;

      const reason = String(getFirstNonEmpty(r, reasonKeys) || "").trim() || "Unspecified";
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }

    const topReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return { reviewCount, topReasons };
  }, [preScreens]);

  // ---------- Block 3: Emerging Patterns (from AI summary text only) ----------
  const emergingPatterns = useMemo(() => {
    const summaryKeys = ["Pre-screen Summary (AI)", "ai_summary", "AI Summary"];
    const counts = new Map<string, number>();

    // keep this VERY conservative to avoid “fake insight”
    const patternMatchers: Array<[string, RegExp]> = [
      ["Fear / nerves", /(nervous|anxious|scared|worried)/i],
      ["Natural results", /(natural|subtle|not too much)/i],
      ["Pain concern", /(hurt|pain|painful|numb)/i],
      ["Longevity concern", /(how long|last|duration)/i],
      ["Downtime concern", /(swelling|bruise|downtime|recovery|aftercare)/i],
    ];

    for (const r of preScreens) {
      const text = String(getFirstNonEmpty(r, summaryKeys) || "");
      if (!text.trim()) continue;

      for (const [label, re] of patternMatchers) {
        if (re.test(text)) counts.set(label, (counts.get(label) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [preScreens]);

  // small helper UI
  const Card = ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
  }) => (
    <div className="bg-white rounded-3xl border shadow-soft p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-[11px] text-uanco-400 mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );

  const Row = ({ left, right }: { left: string; right: string | number }) => (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[12px] text-uanco-500">{left}</span>
      <span className="text-sm font-medium text-uanco-900">{right}</span>
    </div>
  );

  const passRate = Number(metrics?.passRate ?? 0);
  const dropOffRate = Number(metrics?.dropOffRate ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h2 className="text-3xl font-serif">AI Insight</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-uanco-400">
          Using current logged data • Questions window: {windowLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1) Common Questions */}
        <Card
          title="Common Questions"
          subtitle="What clients are repeatedly asking (pattern-level, not guesses)."
        >
          {topQuestionThemes.length === 0 ? (
            <p className="text-sm text-uanco-500">No question data detected yet.</p>
          ) : (
            <div className="divide-y">
              {topQuestionThemes.map((t) => (
                <Row key={t.theme} left={t.theme} right={t.count} />
              ))}
            </div>
          )}
        </Card>

        {/* 2) Booking Friction */}
        <Card
          title="Booking Friction"
          subtitle="What’s most often causing reviews/blocks."
        >
          <div className="divide-y">
            <Row left="Flagged for review" right={bookingFriction.reviewCount} />
            <Row left="Safe rate" right={`${passRate}%`} />
            <Row left="Drop-off rate" right={`${dropOffRate}%`} />
          </div>

          <div className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-uanco-400 mb-2">
              Top reasons (if recorded)
            </p>
            {bookingFriction.topReasons.length === 0 ? (
              <p className="text-sm text-uanco-500">No reasons captured yet.</p>
            ) : (
              <div className="divide-y">
                {bookingFriction.topReasons.map((r) => (
                  <Row key={r.reason} left={r.reason} right={r.count} />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* 3) Emerging Patterns */}
        <Card
          title="Emerging Patterns"
          subtitle="Signals seen inside the AI pre-screen summary text."
        >
          {emergingPatterns.length === 0 ? (
            <p className="text-sm text-uanco-500">No AI summaries detected yet.</p>
          ) : (
            <div className="divide-y">
              {emergingPatterns.map((p) => (
                <Row key={p.label} left={p.label} right={p.count} />
              ))}
            </div>
          )}

          <p className="mt-6 text-[12px] text-uanco-500">
            This is intentionally conservative for v1 (no “made up” insights).
          </p>
        </Card>
      </div>
    </div>
  );
};

export default TreatmentsView;