import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const AIRTABLE_API = "https://api.airtable.com/v0";

function getBearerToken(event: any) {
  const h = event.headers?.authorization || event.headers?.Authorization;
  if (!h) return null;
  const m = String(h).match(/^Bearer (.+)$/i);
  return m?.[1] || null;
}

function airtableHeaders() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new Error("Missing AIRTABLE_PAT");
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

// Filter helper: LINKED RECORD field "Clinic"
function clinicLinkFormula(clinicId: string) {
  const clinicLinkField = process.env.AIRTABLE_CLINIC_LINK_FIELD || "Clinic";
  return `FIND('${clinicId}', ARRAYJOIN({${clinicLinkField}}))`;
}

async function safeFetchTable(baseId: string, tableName: string, formula: string) {
  try {
    const q = new URLSearchParams({
      filterByFormula: formula,
      pageSize: "100",
    }).toString();

    const data = await airtableGet(`/${baseId}/${encodeURIComponent(tableName)}?${q}`);
    return (data.records || []).map((r: any) => ({ id: r.id, ...r.fields }));
  } catch (e: any) {
    console.warn(`[dashboard] safeFetchTable failed for ${tableName}`, e?.message || e);
    return [];
  }
}

function normElig(v: any) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "pass") return "pass";
  if (s === "fail") return "fail";
  if (s === "review") return "review";
  return "";
}

function normStep(v: any) {
  // used for drop-off funnel; supports common field names
  const s = String(v || "").trim();
  return s || "Unknown";
}

function dayKey(dateLike: any) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export const handler: Handler = async (event) => {
  try {
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

    // 5) Fetch everything for this clinic
    const formula = clinicLinkFormula(clinicId);

    const preScreens = await safeFetchTable(baseId, prescreensTable, formula);
    const dropOffs = await safeFetchTable(baseId, dropoffsTable, formula);
    const questions = await safeFetchTable(baseId, questionsTable, formula);
    const treatments = await safeFetchTable(baseId, treatmentsTable, formula);

    // 6) Metrics (computed)
    const totalPreScreens = preScreens.length;

    const eligibilityField = "eligibility";
    const pass = preScreens.filter((r: any) => normElig(r[eligibilityField]) === "pass").length;
    const fail = preScreens.filter((r: any) => normElig(r[eligibilityField]) === "fail").length;
    const review = preScreens.filter((r: any) => normElig(r[eligibilityField]) === "review").length;

    const passRate = totalPreScreens ? Math.round((pass / totalPreScreens) * 100) : 0;
    const dropOffRate = totalPreScreens ? Math.round((dropOffs.length / totalPreScreens) * 100) : 0;

    // ---- failReasons[] ----
    // tries common fields (if none exist, will remain empty)
    const failReasonFieldCandidates = ["fail_reason", "Fail Reason", "Reason", "reason"];
    const failReasonCounts = new Map<string, number>();
    for (const r of preScreens) {
      if (normElig(r[eligibilityField]) !== "fail") continue;
      const reason =
        failReasonFieldCandidates.map((f) => r[f]).find((v) => v !== undefined && v !== null && String(v).trim() !== "") ??
        "Unspecified";
      const key = String(reason).trim();
      failReasonCounts.set(key, (failReasonCounts.get(key) || 0) + 1);
    }
    const failReasons = Array.from(failReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // ---- funnelData[] (simple: by drop-off step) ----
    // tries common step fields
    const stepFieldCandidates = ["dropoff_step", "Drop-off Step", "Step", "step", "Last Step", "last_step"];
    const stepCounts = new Map<string, number>();
    for (const d of dropOffs) {
      const step =
        stepFieldCandidates.map((f) => d[f]).find((v) => v !== undefined && v !== null && String(v).trim() !== "") ?? "Unknown";
      const key = normStep(step);
      stepCounts.set(key, (stepCounts.get(key) || 0) + 1);
    }
    const funnelData = Array.from(stepCounts.entries())
      .map(([step, count]) => ({ step, count }))
      .sort((a, b) => b.count - a.count);

    // ---- treatmentStats[] ----
    // You said treatments interest is stored in PreScreens / DropOffs under "interested_treatments"
    const treatFieldCandidates = ["interested_treatments", "Interested Treatments", "Treatment", "treatment_selected"];
    const tCounts = new Map<string, number>();

    const addTreatmentsFrom = (row: any) => {
      const raw =
        treatFieldCandidates.map((f) => row[f]).find((v) => v !== undefined && v !== null && String(v).trim() !== "");
      if (!raw) return;

      // supports: multi-select array OR comma-separated string
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

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        preScreens,
        dropOffs,
        questions,
        treatments,
        metrics: {
          totalPreScreens,
          passRate,
          dropOffRate,
          hardFails: fail,
          tempFails: review,
          failReasons,
          funnelData,
          treatmentStats,
        },
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