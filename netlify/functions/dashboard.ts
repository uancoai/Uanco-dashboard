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

async function airtableGetFullUrl(url: string) {
  const res = await fetch(url, { headers: airtableHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`Airtable error ${res.status}: ${text}`);
  return JSON.parse(text);
}

// Fetch ALL records from a table (handles pagination).
async function fetchAllFromTable(baseId: string, tableName: string, fields?: string[]) {
  const records: any[] = [];
  let offset: string | undefined;

  while (true) {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);

    // Optional: only request certain fields to reduce payload
    if (fields && fields.length) {
      for (const f of fields) params.append("fields[]", f);
    }

    const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}?${params.toString()}`;
    const data = await airtableGetFullUrl(url);

    const batch = (data.records || []).map((r: any) => ({ id: r.id, ...r.fields }));
    records.push(...batch);

    offset = data.offset;
    if (!offset) break;
  }

  return records;
}

// Filter by linked record field (Clinic) in code.
function filterByClinicLinkedRecord(rows: any[], clinicId: string, linkedFieldName = "Clinic") {
  return rows.filter((r) => Array.isArray(r[linkedFieldName]) && r[linkedFieldName].includes(clinicId));
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

    // IMPORTANT: This must match your linked record field name in each table
    const clinicLinkField = process.env.AIRTABLE_CLINIC_LINK_FIELD || "Clinic";

    // 5) Fetch all records then filter locally (matches analytics behavior; avoids Airtable formula weirdness)
    const allPre = await fetchAllFromTable(baseId, prescreensTable);
    const allDrops = await fetchAllFromTable(baseId, dropoffsTable);
    const allQs = await fetchAllFromTable(baseId, questionsTable);
    const allTs = await fetchAllFromTable(baseId, treatmentsTable);

    const preScreens = filterByClinicLinkedRecord(allPre, clinicId, clinicLinkField);
    const dropOffs = filterByClinicLinkedRecord(allDrops, clinicId, clinicLinkField);
    const questions = filterByClinicLinkedRecord(allQs, clinicId, clinicLinkField);
    const treatments = filterByClinicLinkedRecord(allTs, clinicId, clinicLinkField);

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