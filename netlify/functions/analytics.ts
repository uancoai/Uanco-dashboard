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

async function airtableGet(url: string) {
  const res = await fetch(url, { headers: airtableHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`Airtable error ${res.status}: ${text}`);
  return JSON.parse(text);
}

function asArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

export const handler: Handler = async (event) => {
  try {
    // 1) Require Supabase token
    const token = getBearerToken(event);
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Missing Bearer token" }) };

    // 2) Validate token server-side
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

    // 3) Inputs
    const clinicId = event.queryStringParameters?.clinicId;
    if (!clinicId) return { statusCode: 400, body: JSON.stringify({ error: "Missing clinicId" }) };

    const baseId = process.env.AIRTABLE_BASE_ID!;
    if (!baseId) return { statusCode: 500, body: JSON.stringify({ error: "Missing AIRTABLE_BASE_ID" }) };

    const prescreensTable = process.env.AIRTABLE_TABLE_PRESCREENS || "PreScreens";

    // IMPORTANT: This MUST be the linked record field (Link to another record → Clinics)
    const clinicLinkField = process.env.AIRTABLE_CLINIC_LINK_FIELD || "Clinic";

    // Eligibility field name in Airtable (keep your current)
    const eligibilityField = "eligibility";

    // 4) Pull records WITHOUT formula, then filter in code (more reliable)
    // (We also request only the fields we need to reduce payload)
    const url =
      `${AIRTABLE_API}/${baseId}/${encodeURIComponent(prescreensTable)}` +
      `?pageSize=100&fields[]=${encodeURIComponent(clinicLinkField)}&fields[]=${encodeURIComponent(eligibilityField)}`;

    const pre = await airtableGet(url);
    const rows = (pre.records || []).map((r: any) => ({ id: r.id, ...r.fields }));

    // Filter by linked clinic record id (rec...)
    const preScreens = rows.filter((r: any) => asArray(r[clinicLinkField]).includes(clinicId));

    const total = preScreens.length;
    const pass = preScreens.filter((r: any) => String(r[eligibilityField] || "").toLowerCase() === "pass").length;
    const fail = preScreens.filter((r: any) => String(r[eligibilityField] || "").toLowerCase() === "fail").length;
    const review = preScreens.filter((r: any) => String(r[eligibilityField] || "").toLowerCase() === "review").length;

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        totals: {
          total,
          pass,
          fail,
          review,
          dropoffs: 0,
        },
        daily: [],
      }),
    };
  } catch (e: any) {
    console.error("[analytics] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || "Server error" }) };
  }
};