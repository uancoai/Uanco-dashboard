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

function formulaClinicLinkContains(clinicRecordId: string, linkedFieldName: string) {
  // Linked record fields are arrays of record IDs
  return `FIND('${clinicRecordId}', ARRAYJOIN({${linkedFieldName}}))`;
}

export const handler: Handler = async (event) => {
  try {
    const token = getBearerToken(event);
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Missing Bearer token" }) };

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

    const baseId = process.env.AIRTABLE_BASE_ID!;
    const prescreensTable = process.env.AIRTABLE_TABLE_PRESCREENS || "PreScreens";
    const clinicId = event.queryStringParameters?.clinicId;
    if (!baseId) return { statusCode: 500, body: JSON.stringify({ error: "Missing AIRTABLE_BASE_ID" }) };
    if (!clinicId) return { statusCode: 400, body: JSON.stringify({ error: "Missing clinicId" }) };

    const linkedClinicField = "Clinic Name"; // <- your linked record field name
    const filterByFormula = formulaClinicLinkContains(clinicId, linkedClinicField);

    const q = new URLSearchParams({ filterByFormula, pageSize: "100" }).toString();
    const pre = await airtableGet(`/${baseId}/${encodeURIComponent(prescreensTable)}?${q}`);
    const preScreens = (pre.records || []).map((r: any) => ({ id: r.id, ...r.fields }));

    const total = preScreens.length;
    const eligField = "eligibility";
    const pass = preScreens.filter((r: any) => String(r[eligField] || "").toLowerCase() === "pass").length;
    const fail = preScreens.filter((r: any) => String(r[eligField] || "").toLowerCase() === "fail").length;
    const review = preScreens.filter((r: any) => String(r[eligField] || "").toLowerCase() === "review").length;

    const totals = {
      total,
      pass,
      fail,
      review,
      dropoffs: 0,
    };

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        totals,
        daily: [], // can add later
      }),
    };
  } catch (e: any) {
    console.error("[analytics] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || "Server error" }) };
  }
};