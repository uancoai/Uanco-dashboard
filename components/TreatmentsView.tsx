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
  dropOffs?: any[];
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

function isBookingReady(rec: any) {
  const v = toLower(getFirstNonEmpty(rec, ["booking_intent", "Booking Intent", "Booking intent"]));
  return v === "ready";
}

function isBookingHesitating(rec: any) {
  const v = toLower(getFirstNonEmpty(rec, ["booking_intent", "Booking Intent", "Booking intent"]));
  return v === "hesitating" || v === "hesitate";
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

export default function TreatmentsView({ stats = [], questions = [], preScreens = [], dropOffs = [] }: Props) {
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

  const signals = useMemo(() => {
    const enquiries = preScreens.length;
    const safeToBook = preScreens.filter(isSafe).length;
    const dropOffCount = dropOffs.length;
    const dropOffRate = enquiries ? Math.round((dropOffCount / enquiries) * 100) : 0;
    const readyToBook = preScreens.filter(isBookingReady).length;
    const hesitating = preScreens.filter(isBookingHesitating).length;

    return {
      enquiries,
      safeToBook,
      dropOffCount,
      dropOffRate,
      readyToBook,
      hesitating,
    };
  }, [preScreens, dropOffs]);

  return (
    <div className="space-y-8">
      {/* ✅ Rename this header if you want (recommended: Clinic Signals) */}
      <h2 className="text-3xl font-serif">Clinic Signals</h2>

      {/* 3 blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1) Pre-screen activity */}
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-uanco-400">Pre-screen activity</h3>
              <p className="text-[12px] text-uanco-500 mt-2">
                A snapshot of incoming pre-screens for this clinic.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-uanco-500">Enquiries (pre-screens)</span>
              <span className="font-medium">{signals.enquiries}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-uanco-500">Safe to book</span>
              <span className="font-medium">{signals.safeToBook}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-uanco-500">Drop-offs</span>
              <span className="font-medium">{signals.dropOffCount}</span>
            </div>

            <div className="pt-3 border-t border-uanco-100">
              <div className="flex justify-between text-sm">
                <span className="text-uanco-500">Drop-off rate</span>
                <span className="font-medium">{signals.dropOffRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2) Booking intent */}
        <div className="bg-white p-6 border rounded-3xl shadow-soft">
          <h3 className="text-sm font-bold uppercase tracking-widest text-uanco-400">Booking intent</h3>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-uanco-500">Ready to book</span>
              <span className="font-medium">{signals.readyToBook}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-uanco-500">Hesitating</span>
              <span className="font-medium">{signals.hesitating}</span>
            </div>
            <p className="text-[12px] text-uanco-500 mt-2">
              Captures post-pass intent after the booking prompt.
            </p>
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