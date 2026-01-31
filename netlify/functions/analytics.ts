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

function norm(v: any): string {
  return String(v ?? "").trim().toLowerCase();
}

function asStringArrayField(fields: any, fieldName: string): string[] {
  return asArray(fields?.[fieldName]).map((x) => String(x));
}

// Helper: Normalize outcome values to pass/fail/review/""
function normalizeOutcome(v: any): "pass" | "fail" | "review" | "" {
  const s = String(v || "").trim().toLowerCase();
  if (s === "pass") return "pass";
  if (s === "fail") return "fail";
  // Airtable option is typically "Manual Review"
  if (s === "manual review" || s === "manual_review" || s === "review") return "review";
  return "";
}

// Helper: Fetch all records from Airtable table (with pagination)
async function airtableListAll(baseId: string, tableName: string, params: string): Promise<any[]> {
  const out: any[] = [];
  let offset: string | undefined;
  do {
    const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}?${params}${offset ? `&offset=${encodeURIComponent(offset)}` : ""}`;
    const resp = await airtableGet(url);
    const records = resp?.records || [];
    out.push(...records);
    offset = resp?.offset;
  } while (offset);
  return out;
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
    const clinicId = event.queryStringParameters?.clinicId; // Airtable Clinics record id (rec...)
    const publicClinicKey = event.queryStringParameters?.publicClinicKey; // your plain-text clinic key
    if (!clinicId && !publicClinicKey) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing clinicId or publicClinicKey" }) };
    }

    const baseId = process.env.AIRTABLE_BASE_ID!;
    if (!baseId) return { statusCode: 500, body: JSON.stringify({ error: "Missing AIRTABLE_BASE_ID" }) };

    const prescreensTable = process.env.AIRTABLE_TABLE_PRESCREENS || "PreScreens";
    const dropoffsTable = process.env.AIRTABLE_TABLE_DROPOFFS || "PreScreen_DropOffs";

    // IMPORTANT: This MUST be the linked record field (Link to another record → Clinics)
    const clinicLinkField = process.env.AIRTABLE_CLINIC_LINK_FIELD || "Clinic";

    // Eligibility field name in Airtable (keep your current)
    const eligibilityField = "eligibility";

    // Public Clinic Key field name in Airtable
    const publicClinicKeyField = process.env.AIRTABLE_PUBLIC_CLINIC_KEY_FIELD || "Public Clinic Key";

    // 4) Pull records WITHOUT formula, then filter in code (more reliable)
    // (We also request only the fields we need to reduce payload)
    const params =
      `pageSize=100` +
      `&fields[]=${encodeURIComponent(clinicLinkField)}` +
      `&fields[]=${encodeURIComponent(eligibilityField)}` +
      `&fields[]=${encodeURIComponent(publicClinicKeyField)}`;

    const records = await airtableListAll(baseId, prescreensTable, params);
    const rows = records.map((r: any) => ({ id: r.id, ...r.fields }));

    const wantKey = publicClinicKey ? norm(publicClinicKey) : "";
    const wantClinicId = clinicId ? String(clinicId) : "";

    const preScreens = rows.filter((r: any) => {
      if (wantKey) {
        const keys = asArray(r[publicClinicKeyField]).map(norm);
        return keys.includes(wantKey);
      }
      return asArray(r[clinicLinkField]).includes(wantClinicId);
    });

    // Drop-offs: pull the DropOffs table and count INCOMPLETE attempts for this clinic
    const dropParams =
      `pageSize=100` +
      `&fields[]=${encodeURIComponent(clinicLinkField)}` +
      `&fields[]=${encodeURIComponent(publicClinicKeyField)}` +
      `&fields[]=${encodeURIComponent("outcome_type_calc")}`;

    const dropRecords = await airtableListAll(baseId, dropoffsTable, dropParams);
    const dropRows = dropRecords.map((r: any) => ({ id: r.id, ...r.fields }));

    const dropoffsForClinic = dropRows.filter((r: any) => {
      if (wantKey) {
        const keys = asArray(r[publicClinicKeyField]).map(norm);
        return keys.includes(wantKey);
      }
      return asArray(r[clinicLinkField]).includes(wantClinicId);
    });

    const dropoffs = dropoffsForClinic.filter((r: any) => norm(r["outcome_type_calc"]) === "incomplete").length;

    const total = preScreens.length;
    const pass = preScreens.filter((r: any) => normalizeOutcome(r[eligibilityField]) === "pass").length;
    const fail = preScreens.filter((r: any) => normalizeOutcome(r[eligibilityField]) === "fail").length;
    const review = preScreens.filter((r: any) => normalizeOutcome(r[eligibilityField]) === "review").length;

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        totals: {
          total,
          pass,
          fail,
          review,
          dropoffs,
        },
        daily: [],
      }),
    };
  } catch (e: any) {
    console.error("[analytics] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || "Server error" }) };
  }
};