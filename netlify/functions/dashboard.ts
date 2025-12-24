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

// ✅ Filter helper: use the LINKED RECORD field "Clinic"
function clinicLinkFormula(clinicId: string) {
  const clinicLinkField = process.env.AIRTABLE_CLINIC_LINK_FIELD || "Clinic";
  // Airtable linked record field stores an array of rec... ids, so ARRAYJOIN makes it searchable.
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

    // 5) Fetch everything for this clinic (using linked record field Clinic)
    const formula = clinicLinkFormula(clinicId);

    const preScreens = await safeFetchTable(baseId, prescreensTable, formula);
    const dropOffs = await safeFetchTable(baseId, dropoffsTable, formula);
    const questions = await safeFetchTable(baseId, questionsTable, formula);
    const treatments = await safeFetchTable(baseId, treatmentsTable, formula);

    // 6) Metrics
    const totalPreScreens = preScreens.length;

    const eligibilityField = "eligibility";
    const pass = preScreens.filter((r: any) => String(r[eligibilityField] || "").toLowerCase() === "pass").length;
    const fail = preScreens.filter((r: any) => String(r[eligibilityField] || "").toLowerCase() === "fail").length;
    const review = preScreens.filter((r: any) => String(r[eligibilityField] || "").toLowerCase() === "review").length;

    const passRate = totalPreScreens ? Math.round((pass / totalPreScreens) * 100) : 0;
    const dropOffRate = totalPreScreens ? Math.round((dropOffs.length / totalPreScreens) * 100) : 0;

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
          failReasons: [],
          funnelData: [],
          treatmentStats: [],
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