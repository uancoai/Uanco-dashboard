import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const AIRTABLE_API = "https://api.airtable.com/v0";
// Bump this string whenever you deploy backend changes, so the frontend/Network tab can confirm updates.
const DASHBOARD_API_VERSION = "dashboard_v1_2026-01-31_exclude-dropoff-fails-from-totals_v1";

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
async function safeFetchTable(baseId: string, tableName: string, clinicId: string | null) {
  try {
    const pageSize = 100;
    let offset: string | undefined = undefined;
    const all: any[] = [];

    // Airtable pagination: keep fetching while an `offset` is returned
    do {
      const params = new URLSearchParams({ pageSize: String(pageSize) });
      if (offset) params.set("offset", offset);

      const data = await airtableGet(`/${baseId}/${encodeURIComponent(tableName)}?${params.toString()}`);
      const batch = (data.records || []).map((r: any) => ({ id: r.id, ...r.fields }));
      all.push(...batch);
      offset = data.offset;
    } while (offset);

    const records = all;

    // ✅ Filter in code.
    // Airtable clinic references can be stored either as:
    // - a linked-record array field (commonly named "Clinic") containing ["rec..."]
    // - OR a text/calc field that contains the clinic record id
    // Different bases sometimes rename the field, so we check a small set of candidates.
    const clinicFieldCandidates = [
      "Clinic",
      "clinic",
      "clinic_id",
      "Clinic ID",
      "Clinic Record ID",
      "Clinic Record ID (from Clinic)",
      "clinic_record_id",
      "airtable_clinic_record_id",
    ];

    const recordMatchesClinic = (r: any) => {
      // Super-admin "all clinics" mode: if clinicId is not provided, do not filter.
      if (!clinicId) return true;

      for (const f of clinicFieldCandidates) {
        const v = r?.[f];

        // Linked-record field: ["rec..."]
        if (Array.isArray(v) && v.includes(clinicId)) return true;

        // Text / formula field that includes the rec id
        if (typeof v === "string" && v.includes(clinicId)) return true;
      }
      return false;
    };

    const filtered = records.filter(recordMatchesClinic);

    return { records: filtered, error: null as string | null };
  } catch (e: any) {
    return { records: [], error: e?.message || String(e) };
  }
}

/** ---------- Normalisers ---------- */
function friendlyFailReason(categoryOrText: any, reasonText?: any): string {
  const raw = String(categoryOrText ?? "").trim();
  const code = raw.toUpperCase();
  const reason = String(reasonText ?? "").toLowerCase();

  // Explicit policy category (now supported by Airtable calc)
  if (code === "POLICY_NOT_ACCEPTED") return "Policy not accepted";

  // Split OTHER_FAIL into clinic-friendly buckets using the human reason text
  if (code === "OTHER_FAIL") {
    if (reason.includes("did not accept") || reason.includes("policy")) {
      return "Policy not accepted";
    }
    if (reason.includes("chose to stop") || reason.includes("self-assessed not suitable")) {
      return "Stopped / self-assessed not suitable";
    }
    return "Other fail";
  }

  const map: Record<string, string> = {
    PREGNANT_BREASTFEEDING: "Pregnant or breastfeeding",
    ANTIBIOTICS: "Antibiotics in last 14 days",
    ALLERGIES: "Allergies declared",
    AGE: "Underage / age not verified",
  };

  return map[code] || raw || "Unspecified";
}

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

    // Optional clinic override for super admins
    const clinicIdOverride =
      event.queryStringParameters?.clinicid ||
      event.queryStringParameters?.clinic_id ||
      event.queryStringParameters?.clinicId ||
      null;

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

    // 3) Load caller profile (role + clinic mapping)
    const uid = userData.user.id;
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", uid)
      .single();

    if (profileErr || !profile) {
      return { statusCode: 403, body: JSON.stringify({ error: "Missing profile mapping" }) };
    }

    const isSuperAdmin = String(profile.role || "").toLowerCase() === "super_admin";

    // 4) Resolve clinic scoping
    // Airtable "Clinic" linked-record fields contain Airtable record IDs (rec...),
    // but profiles.clinic_id is a Supabase UUID. We must resolve UUID -> airtable_clinic_record_id.

    const resolveClinicByUuid = async (uuid: string) => {
      const { data, error } = await supabaseAdmin
        .from("clinics")
        .select("id, public_clinic_key, airtable_clinic_record_id")
        .eq("id", uuid)
        .single();
      if (error) throw new Error(`Clinic lookup failed: ${error.message}`);
      if (!data) throw new Error("Clinic not found");
      if (!data.airtable_clinic_record_id) throw new Error("Clinic missing airtable_clinic_record_id");
      return data as { id: string; public_clinic_key: string | null; airtable_clinic_record_id: string };
    };

    // Default to the caller's clinic UUID from profiles
    const callerClinicUuid = String(profile.clinic_id || "").trim();
    if (!callerClinicUuid) {
      return { statusCode: 403, body: JSON.stringify({ error: "Missing clinic mapping (profiles.clinic_id)" }) };
    }

    // Resolve the caller's clinic (needed for Airtable scoping + super-admin internal clinic detection)
    const callerClinic = await resolveClinicByUuid(callerClinicUuid);

    // Super admin behaviour:
    // - If no override: all clinics
    // - If the UI passes the admin's own internal clinic Airtable record id, treat it like "no override"
    const ovTrim = clinicIdOverride ? String(clinicIdOverride).trim() : "";
    const isAdminInternalClinic =
      isSuperAdmin && !!ovTrim && ovTrim === callerClinic.airtable_clinic_record_id;

    // Determine whether we're in all-clinics mode for super admins
    const allClinicsMode = isSuperAdmin && (!clinicIdOverride || isAdminInternalClinic);

    // Resolve clinic scoping

    let clinic_uuid: string | null = null;
    let airtable_clinic_record_id: string | null = null;

    if (allClinicsMode) {
      // Super admin default: see everything
      clinic_uuid = null;
      airtable_clinic_record_id = null;
    } else {
      // Start from the caller's clinic
      clinic_uuid = callerClinic.id;
      airtable_clinic_record_id = callerClinic.airtable_clinic_record_id;

      // Optional override for super admins
      if (isSuperAdmin && clinicIdOverride) {
        const ov = String(clinicIdOverride).trim();
        if (ov) {
          if (ov.startsWith("rec")) {
            airtable_clinic_record_id = ov;
            // Keep clinic_uuid as the caller clinic UUID when overriding by Airtable id only
          } else {
            const resolved = await resolveClinicByUuid(ov);
            clinic_uuid = resolved.id;
            airtable_clinic_record_id = resolved.airtable_clinic_record_id;
          }
        }
      }
    }

    // For backwards-compat, keep a single clinicId field in responses (UUID when known)
    const clinicId = clinic_uuid;

    // 5) Airtable base + tables
    const baseId = process.env.AIRTABLE_BASE_ID!;
    if (!baseId) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing AIRTABLE_BASE_ID" }) };
    }

    const prescreensTable = process.env.AIRTABLE_TABLE_PRESCREENS || "PreScreens";
    const dropoffsTable = process.env.AIRTABLE_TABLE_DROPOFFS || "PreScreen_DropOffs";
    const questionsTable = process.env.AIRTABLE_TABLE_QUESTIONS || "AI_Questions";
    const treatmentsTable = process.env.AIRTABLE_TABLE_TREATMENTS || "Treatments";

    // 6) Fetch everything for this clinic (filter in code)
    const clinicFilterId = allClinicsMode ? null : airtable_clinic_record_id;

    const preRes = await safeFetchTable(baseId, prescreensTable, clinicFilterId);
    const dropRes = await safeFetchTable(baseId, dropoffsTable, clinicFilterId);
    const qRes = await safeFetchTable(baseId, questionsTable, clinicFilterId);
    const tRes = await safeFetchTable(baseId, treatmentsTable, clinicFilterId);

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
    // Canonical incompletes (true drop-offs) live in DropOffs table
    const canonicalIncompletes = dropOffs.filter((r: any) => {
      const outcome = String(r.outcome_type_calc ?? "").trim().toUpperCase();
      const canon = String(r.canonical_record_calc ?? "").trim().toUpperCase();
      return outcome === "INCOMPLETE" && canon === "YES";
    });
    const questions = qRes.records;
    const treatments = tRes.records;

    // 7) Metrics (computed)
    // Completed prescreens for the dashboard are PASS + REVIEW + FAIL (exclude blanks/unknown)
    const preScreensCompleted = preScreens.filter((r: any) => {
      const e = effectiveEligibility(r);
      return e === "pass" || e === "review" || e === "fail";
    });

    // Compute effective status using the same override logic as the UI
    let pass = 0;
    let review = 0;
    let unsuitableFromPrescreens = 0;

    for (const r of preScreensCompleted) {
      const e = effectiveEligibility(r);
      if (e === "pass") pass++;
      else if (e === "review") review++;
      else if (e === "fail") unsuitableFromPrescreens++;
    }

    // ✅ Unsuitable + totals should reflect PreScreens table only
    // (DropOffs table FAIL rows are tracked separately but do NOT contribute to totals)
    const unsuitableCount = unsuitableFromPrescreens;

    // Total prescreens = PASS + REVIEW + FAIL (PreScreens only)
    const totalPreScreens = pass + review + unsuitableCount;

    // Optional visibility (kept separate from totals)
    const hardFailsFromDropoffs = canonicalFails.length;
    const hardFailsTotal = unsuitableFromPrescreens + canonicalFails.length;

    // Pass rate is "safe to book" as a share of completed prescreens
    const passRate = totalPreScreens ? Math.round((pass / totalPreScreens) * 100) : 0;

    // Drop-off rate should reflect INCOMPLETE-only vs completed prescreens
    const dropOffRate = totalPreScreens ? Math.round((canonicalIncompletes.length / totalPreScreens) * 100) : 0;

    const prescreenFails = preScreensCompleted.filter((r: any) => effectiveEligibility(r) === "fail");
    const allHardFails = [...canonicalFails, ...prescreenFails];

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
    for (const r of allHardFails) {
      const reason =
        failReasonFieldCandidates
          .map((f) => r[f])
          .find((v) => v !== undefined && v !== null && String(v).trim() !== "") ?? "Unspecified";

      const key = friendlyFailReason(reason, r.reason);
      failReasonCounts.set(key, (failReasonCounts.get(key) || 0) + 1);
    }
    const failReasons = Array.from(failReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // ---- funnelData[] ----
    const stepFieldCandidates = ["dropoff_step", "Drop-off Step", "Step", "step", "Last Step", "last_step"];
    const stepCounts = new Map<string, number>();
    for (const d of canonicalIncompletes) {
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

    // Recent clinical fails (FAIL + canonical YES)
    const recentClinicalFails = canonicalFails.slice(0, 20);

    // Merged recent activity feed (SAFE/REVIEW + clinical FAIL). This is an alias-friendly shape for older UIs.
    const mergedRecentActivity = [
      ...preScreensCompleted.slice(0, 50).map((r: any) => {
        const e = effectiveEligibility(r);
        const activity_kind = e === "pass" ? "safe" : e === "review" ? "review" : e === "fail" ? "unsuitable" : "unknown";
        return { ...r, activity_kind };
      }),
      ...recentClinicalFails.map((r: any) => ({ ...r, activity_kind: "unsuitable" })),
    ];

    const activityDateKeys = [
      "Created time",
      "Created Time",
      "created_at",
      "submitted_at",
      "Submitted At",
      "Webhook Timestamp",
      "webhook_timestamp",
    ];
    mergedRecentActivity.sort((a: any, b: any) => {
      const va = activityDateKeys.map((k) => a[k]).find((x) => x != null && String(x).trim() !== "");
      const vb = activityDateKeys.map((k) => b[k]).find((x) => x != null && String(x).trim() !== "");
      return safeDate(vb) - safeDate(va);
    });

    // Debug info only when ?debug=1
    const debugInfo = debug
      ? {
          uid,
          isSuperAdmin,
          baseIdSuffix: String(baseId).slice(-6),
          tables: { prescreensTable, dropoffsTable, questionsTable, treatmentsTable },
          clinicId,
          clinic_uuid,
          airtable_clinic_record_id,
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
        preScreens: preScreensCompleted,
        dropOffs,
        questions,
        treatments,
        apiVersion: DASHBOARD_API_VERSION,
        is_super_admin: isSuperAdmin,
        clinicId,
        clinic_uuid,
        airtable_clinic_record_id,
        all_clinics_mode: allClinicsMode,
        metrics: {
          totalPreScreens,
          passRate,
          dropOffRate,
          // Card-ready counts
          unsuitableCount,
          dropOffsCount: canonicalIncompletes.length, // INCOMPLETE + canonical YES
          // Hard fails (dashboard) = FAIL outcomes in PreScreens
          hardFails: unsuitableCount,
          // Optional: visibility of FAIL outcomes still living in DropOffs (kept OUT of totals)
          hardFailsFromDropoffs,
          hardFailsTotal,
          // Temp fails are your REVIEW queue (manual_review_flag), which can later be cleared to PASS
          tempFails: review,
          // Helpful for debugging / rollout
          canonicalFailCount: canonicalFails.length,
          failReasons,
          funnelData,
          treatmentStats,
        },
        overview: {
          totalPreScreens,
          passRate,
          unsuitableCount,
          dropOffsCount: canonicalIncompletes.length,
          reviewCount: review,
        },
        clinicSignals: {
          totalPreScreens,
          passRate,
          unsuitableCount,
          dropOffsCount: canonicalIncompletes.length,
          reviewCount: review,
        },
        // Backwards-compatible aliases (in case the frontend expects a different key)
        activity: mergedRecentActivity.slice(0, 20),
        recent: mergedRecentActivity.slice(0, 20),
        recent_activity: mergedRecentActivity.slice(0, 20),
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
