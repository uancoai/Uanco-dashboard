import React, { useMemo } from "react";

type Props = {
  // from App.tsx you already pass:
  // stats={dashboardData?.metrics?.treatmentStats ?? []}
  // questions={dashboardData?.questions ?? []}
  stats?: any[];
  questions?: any[];
  // add this in App.tsx when ready:
  // preScreens={dashboardData?.preScreens ?? []}
  preScreens?: any[];
};

function getFirstNonEmpty(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function toLower(v: any) {
  return String(v || "").trim().toLowerCase();
}

function isSafe(rec: any) {
  const e = toLower(getFirstNonEmpty(rec, ["eligibility", "Eligibility"]));
  return e === "pass" || e === "safe";
}

function isBooked(rec: any) {
  const b = toLower(getFirstNonEmpty(rec, ["booking_status", "Booking Status"]));
  return b === "booked";
}

function extractQuestionText(q: any): string {
  return (
    String(
      getFirstNonEmpty(q, [
        "question",
        "Question",
        "question_text",
        "Question Text",
        "text",
        "Text",
        "message",
        "Message",
      ]) || ""
    )
      .replace(/\s+/g, " ")
      .trim() || ""
  );
}

// Very simple theme buckets (v1). No AI guessing — just keyword matching.
const THEME_RULES: { key: string; label: string; keywords: string[] }[] = [
  { key: "pain", label: "Pain / does it hurt?", keywords: ["hurt", "pain", "needle", "numb", "anesthetic"] },
  { key: "longevity", label: "How long does it last?", keywords: ["how long", "last", "longevity", "duration", "wear off"] },
  { key: "results", label: "Results / natural look", keywords: ["natural", "results", "look", "before", "after", "shape"] },
  { key: "downtime", label: "Swelling / downtime", keywords: ["swelling", "bruise", "downtime", "recovery", "side effect"] },
  { key: "safety", label: "Safety / risks", keywords: ["safe", "risk", "danger", "complication", "infection", "vascular"] },
  { key: "price", label: "Price / cost", keywords: ["price", "cost", "£", "deposit", "pay", "finance"] },
];

function detectThemes(text: string): string[] {
  const t = text.toLowerCase();
  const hits: string[] = [];
  for (const rule of THEME_RULES) {
    if (rule.keywords.some((kw) => t.includes(kw))) hits.push(rule.key);
  }
  return hits.length ? hits : ["other"];
}

export default function TreatmentsView({ stats = [], questions = [], preScreens = [] }: Props) {
  const booking = useMemo(() => {
    const safe = preScreens.filter(isSafe);
    const safeBooked = safe.filter(isBooked);
    const safePending = safe.length - safeBooked.length;

    const pctBooked = safe.length ? Math.round((safeBooked.length / safe.length) * 100) : 0;

    return {
      safeTotal: safe.length,
      bookedSafe: safeBooked.length,
      pendingSafe: safePending,
      pctBooked,
    };
  }, [preScreens]);

  const questionInsights = useMemo(() => {
    const texts = questions.map(extractQuestionText).filter(Boolean);

    // Count themes
    const themeCounts = new Map<string, number>();

    for (const txt of texts) {
      const themes = detectThemes(txt);
      for (const th of themes) {
        themeCounts.set(th, (themeCounts.get(th) || 0) + 1);
      }
    }

    const sortedThemes = Array.from(themeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: THEME_RULES.find((r) => r.key === key)?.label || (key === "other" ? "Other" : key),
        count,
      }));

    return { total: texts.length, themes: sortedThemes };
  }, [questions]);

  // ✅ Remove "Other" from the list so the UI stays useful (and avoids frustration).
  const meaningfulThemes = useMemo(() => {
    return questionInsights.themes.filter((t) => String(t.key).toLowerCase() !== "other");
  }, [questionInsights.themes]);

  const emerging = useMemo(() => {
    // Only show an "emerging pattern" if:
    // - we have a real theme (not Other)
    // - it shows up at least twice (avoid noise)
    const top = meaningfulThemes[0];
    const hasSignal = !!top && Number(top.count) >= 2;

    if (!hasSignal) {
      return {
        headline: "No clear behavioural patterns detected yet.",
        secondary: null as string | null,
        suggestion: null as string | null,
      };
    }

    // Optional secondary only if it exists and has at least 2 hits as well
    const second = meaningfulThemes[1];
    const secondary =
      second && Number(second.count) >= 2 ? `Next most common: ${second.label}` : null;

    // Keep suggestion simple and non-annoying.
    const suggestion = `Consider adding a short FAQ or post that answers this theme clearly.`;

    return {
      headline: `Most common theme: ${top.label}`,
      secondary,
      suggestion,
    };
  }, [meaningfulThemes]);

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-serif">AI Insight</h2>

      {/* 3 blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1) Booking friction */}
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-uanco-400">Booking friction</h3>
              <p className="text-[12px] text-uanco-500 mt-2">
                Clients who are SAFE but still not marked as booked.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-uanco-500">Safe total</span>
              <span className="font-medium">{booking.safeTotal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-uanco-500">Safe + booked</span>
              <span className="font-medium">{booking.bookedSafe}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-uanco-500">Safe + pending</span>
              <span className="font-medium">{booking.pendingSafe}</span>
            </div>

            <div className="pt-3 border-t border-uanco-100">
              <div className="flex justify-between text-sm">
                <span className="text-uanco-500">Booked rate (safe)</span>
                <span className="font-medium">{booking.pctBooked}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2) Common questions */}
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <h3 className="text-sm font-bold uppercase tracking-widest text-uanco-400">What clients are asking</h3>
          <p className="text-[12px] text-uanco-500 mt-2">
            Simple grouping of raw questions (no guessing).
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-uanco-500">Questions captured</span>
              <span className="font-medium">{questionInsights.total}</span>
            </div>

            {meaningfulThemes.length === 0 ? (
              <p className="text-[13px] text-uanco-500 mt-4">
                No recurring question themes detected yet.
              </p>
            ) : (
              meaningfulThemes.slice(0, 3).map((t) => (
                <div key={t.key} className="flex justify-between text-sm">
                  <span className="text-uanco-500">{t.label}</span>
                  <span className="font-medium">{t.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3) Emerging patterns */}
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <h3 className="text-sm font-bold uppercase tracking-widest text-uanco-400">Emerging pattern</h3>
          <p className="text-[12px] text-uanco-500 mt-2">
            A plain-English summary based on the most common question theme.
          </p>

          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium text-uanco-900">{emerging.headline}</p>
            {emerging.secondary && <p className="text-sm text-uanco-600">{emerging.secondary}</p>}
            {emerging.suggestion && <p className="text-sm text-uanco-600">{emerging.suggestion}</p>}
          </div>
        </div>
      </div>

      {/* Optional: treatment interest (kept simple) */}
      {stats?.length > 0 && (
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <h3 className="text-sm font-bold uppercase tracking-widest text-uanco-400">Treatment interest</h3>
          <p className="text-[12px] text-uanco-500 mt-2">
            What clients *said they’re interested in* during pre-screen (not bookings).
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.slice(0, 6).map((s: any, idx: number) => (
              <div key={s.treatment || s.name || idx} className="rounded-2xl border border-uanco-100 p-4">
                <p className="text-sm font-medium text-uanco-900 truncate">{s.treatment || s.name}</p>
                <p className="text-[12px] text-uanco-500 mt-1">Count: {s.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}