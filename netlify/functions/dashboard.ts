import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const AIRTABLE_API = "https://api.airtable.com/v0";

/** ---------- Auth helpers ---------- */
function getBearerToken(event: any) {
  const h = event.headers?.authorization || event.headers?.Authorization;
  if (!h) return null;
  const m = String(h).match(/^Bearer (.+)$/i);
  return m?.[1] || null;
}

/** ---------- Airtable helpers ---------- */
function airtableHeaders() {
  // Support either env var name (older: AIRTABLE_PAT, newer: AIRTABLE_TOKEN)
  const pat = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;
  if (!pat) throw new Error("Missing AIRTABLE_PAT or AIRTABLE_TOKEN");
  return {
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
  };
}

async function airtableGet(path: string) {
  const res = await fetch(`${AIRTABLE_API}${path}`, { headers: airtableHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`Airtable error ${res.status}: ${text}`);
  return JSON.parse(text);
}

/**
 * Safe fetch table:
 * - Fetches WITHOUT filterByFormula (avoids Airtable silent filter failure)
 * - Filters in code by linked record field "Clinic" containing clinicId
 * - Returns error string (not thrown) when Airtable fails
 */
async function safeFetchTable(baseId: string, tableName: string, clinicId: string) {
  try {
    const q = new URLSearchParams({
      pageSize: "100",
    }).toString();

    const data = await airtableGet(`/${baseId}/${encodeURIComponent(tableName)}?${q}`);
    const records = (data.records || []).map((r: any) => ({ id: r.id, ...r.fields }));

    // ✅ Filter in code (linked record field is array of rec... ids)
    const filtered = records.filter((r: any) => Array.isArray(r.Clinic) && r.Clinic.includes(clinicId));

    return { records: filtered, error: null as string | null };
  } catch (e: any) {
    return { records: [], error: e?.message || String(e) };
  }
}

/** ---------- Normalisers ---------- */
function normElig(v: any) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "pass") return "pass";
  if (s === "fail") return "fail";
  if (s === "review") return "review";
  return "";
}

function normStep(v: any) {
  const s = String(v || "").trim();
  return s || "Unknown";
}

function isTruthy(v: any) {
  const s = String(v ?? "").trim().toLowerCase();
  return v === true || s === "true" || s === "yes" || s === "1" || s === "y";
}

// Mirrors the frontend override rules:
// - manual_review_flag (or similar) forces REVIEW unless review_complete is true
// - otherwise, eligibility decides
function effectiveEligibility(rec: any): "pass" | "review" | "fail" | "" {
  const reviewComplete =
    rec["Review Complete"] ?? rec.review_complete ?? rec.reviewComplete ?? rec["review_complete"];
  if (isTruthy(reviewComplete)) {
    // If review is complete, fall back to eligibility
    return normElig(rec.eligibility ?? rec["Eligibility"]);
  }

  const manualReviewFlag =
    rec.manual_review_flag ??
    rec["manual_review_flag"] ??
    rec["Manual Review Flag"] ??
    rec["manual review flag"] ??
    rec["Flagged for Review"] ??
    rec.flagged_for_review ??
    rec["flagged_for_review"];

  if (isTruthy(manualReviewFlag)) return "review";

  return normElig(rec.eligibility ?? rec["Eligibility"]);
}

function safeDate(v: any): number {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** ---------- Handler ---------- */
export const handler: Handler = async (event) => {
  try {
    // Debug mode ONLY when explicitly requested: ?debug=1
    const debug = event.queryStringParameters?.debug === "1";

    // 1) Require Supabase token
    const token = getBearerToken(event);
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing Bearer token" }) };
    }

    // 2) Validate token server-side (Supabase service role)
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing Supabase server env vars" }) };
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid session token" }) };
    }

    // 3) Validate query
    const clinicId = event.queryStringParameters?.clinicId;
    if (!clinicId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing clinicId" }) };
    }

    // 4) Airtable base + tables
    const baseId = process.env.AIRTABLE_BASE_ID!;
    if (!baseId) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing AIRTABLE_BASE_ID" }) };
    }

    const prescreensTable = process.env.AIRTABLE_TABLE_PRESCREENS || "PreScreens";
    const dropoffsTable = process.env.AIRTABLE_TABLE_DROPOFFS || "PreScreen_DropOffs";
    const questionsTable = process.env.AIRTABLE_TABLE_QUESTIONS || "AI_Questions";
    const treatmentsTable = process.env.AIRTABLE_TABLE_TREATMENTS || "Treatments";

    // 5) Fetch everything for this clinic (filter in code)
    const preRes = await safeFetchTable(baseId, prescreensTable, clinicId);
    const dropRes = await safeFetchTable(baseId, dropoffsTable, clinicId);
    const qRes = await safeFetchTable(baseId, questionsTable, clinicId);
    const tRes = await safeFetchTable(baseId, treatmentsTable, clinicId);

    const preScreens = preRes.records;
    // Sort newest-first so UI "recent" is consistent even if the client doesn't sort
    const preDateKeys = [
      "Created time",
      "Created Time",
      "created_at",
      "submitted_at",
      "Submitted At",
      "Webhook Timestamp",
      "webhook_timestamp",
    ];
    preScreens.sort((a: any, b: any) => {
      const va = preDateKeys.map((k) => a[k]).find((x) => x != null && String(x).trim() !== "");
      const vb = preDateKeys.map((k) => b[k]).find((x) => x != null && String(x).trim() !== "");
      return safeDate(vb) - safeDate(va);
    });
    const dropOffs = dropRes.records;
    // Canonical hard fails (true failed prescreens) live in DropOffs table
    const canonicalFails = dropOffs.filter((r: any) => {
      const outcome = String(r.outcome_type_calc ?? "").trim().toUpperCase();
      const canon = String(r.canonical_record_calc ?? "").trim().toUpperCase();
      return outcome === "FAIL" && canon === "YES";
    });
    const questions = qRes.records;
    const treatments = tRes.records;

    // 6) Metrics (computed)
    const totalPreScreens = preScreens.length;

    // Compute effective status using the same override logic as the UI
    let pass = 0;
    let fail = 0;
    let review = 0;

    for (const r of preScreens) {
      const e = effectiveEligibility(r);
      if (e === "pass") pass++;
      else if (e === "fail") fail++;
      else if (e === "review") review++;
    }

    // Drop-off rate includes all DropOffs (INCOMPLETE + FAIL) vs completed prescreens
    const dropOffRate = totalPreScreens ? Math.round((dropOffs.length / totalPreScreens) * 100) : 0;

    // ---- failReasons[] ----
    const failReasonFieldCandidates = [
      "fail_reason_category_calc",
      "fail_reason_category",
      "fail_reason",
      "Fail Reason",
      "Reason",
      "reason",
    ];
    const failReasonCounts = new Map<string, number>();
    for (const r of canonicalFails) {
      const reason =
        failReasonFieldCandidates
          .map((f) => r[f])
          .find((v) => v !== undefined && v !== null && String(v).trim() !== "") ?? "Unspecified";

      const key = String(reason).trim();
      failReasonCounts.set(key, (failReasonCounts.get(key) || 0) + 1);
    }
    const failReasons = Array.from(failReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // ---- funnelData[] ----
    const stepFieldCandidates = ["dropoff_step", "Drop-off Step", "Step", "step", "Last Step", "last_step"];
    const stepCounts = new Map<string, number>();
    for (const d of dropOffs) {
      const step =
        stepFieldCandidates
          .map((f) => d[f])
          .find((v) => v !== undefined && v !== null && String(v).trim() !== "") ?? "Unknown";
      const key = normStep(step);
      stepCounts.set(key, (stepCounts.get(key) || 0) + 1);
    }
    const funnelData = Array.from(stepCounts.entries())
      .map(([step, count]) => ({ step, count }))
      .sort((a, b) => b.count - a.count);

    // ---- treatmentStats[] ----
    const treatFieldCandidates = ["interested_treatments", "Interested Treatments", "Treatment", "treatment_selected"];
    const tCounts = new Map<string, number>();

    const addTreatmentsFrom = (row: any) => {
      const raw = treatFieldCandidates
        .map((f) => row[f])
        .find((v) => v !== undefined && v !== null && String(v).trim() !== "");
      if (!raw) return;

      const items = Array.isArray(raw)
        ? raw
        : String(raw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      for (const item of items) {
        const key = String(item).trim();
        tCounts.set(key, (tCounts.get(key) || 0) + 1);
      }
    };

    preScreens.forEach(addTreatmentsFrom);
    dropOffs.forEach(addTreatmentsFrom);

    const treatmentStats = Array.from(tCounts.entries())
      .map(([treatment, count]) => ({ treatment, count }))
      .sort((a, b) => b.count - a.count);

    // Debug info only when ?debug=1
    const debugInfo = debug
      ? {
          baseIdSuffix: String(baseId).slice(-6),
          tables: { prescreensTable, dropoffsTable, questionsTable, treatmentsTable },
          clinicId,
          airtableErrors: {
            PreScreens: preRes.error,
            PreScreen_DropOffs: dropRes.error,
            AI_Questions: qRes.error,
            Treatments: tRes.error,
          },
          counts: {
            preScreens: preScreens.length,
            dropOffs: dropOffs.length,
            questions: questions.length,
            treatments: treatments.length,
          },
        }
      : undefined;

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        // Prevent stale dashboard data via CDN/function caching
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      body: JSON.stringify({
        preScreens,
        dropOffs,
        questions,
        treatments,
        metrics: {
          totalPreScreens,
          passRate,
          dropOffRate,
          // Hard fails come from canonical DropOff records (true FAIL outcomes)
          hardFails: canonicalFails.length,
          // Temp fails are your REVIEW queue (manual_review_flag), which can later be cleared to PASS
          tempFails: review,
          // Helpful for debugging / rollout
          canonicalFailCount: canonicalFails.length,
          failReasons,
          funnelData,
          treatmentStats,
        },
        ...(debugInfo ? { debug: debugInfo } : {}),
      }),
    };
  } catch (e: any) {
    console.error("[dashboard] error", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || "Server error" }),
    };
  }
};