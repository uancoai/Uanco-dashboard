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
  const baseId = process.env.AIRTABLE_BASE_ID;

  // ✅ Safe debug logs (never prints the token itself)
  console.log("[env] AIRTABLE_PAT exists:", !!pat);
  console.log("[env] AIRTABLE_PAT length:", pat ? pat.length : 0);
  console.log("[env] AIRTABLE_BASE_ID:", baseId ? `${baseId.slice(0, 6)}...` : "MISSING");

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

function escFormulaValue(v: string) {
  // escape single quotes for Airtable formula strings
  return v.replace(/'/g, "\\'");
}

export const handler: Handler = async (event) => {
  try {
    const token = getBearerToken(event);
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing Bearer token" }) };
    }

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

    const email = userData.user.email;
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: "User email missing" }) };
    }

    const baseId = process.env.AIRTABLE_BASE_ID!;
    const clinicsTable = process.env.AIRTABLE_TABLE_CLINICS || "Clinics";
    if (!baseId) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing AIRTABLE_BASE_ID" }) };
    }

    // Match your Clinics table field that stores dashboard login email.
    // If your field name differs, change this string ONLY.
    const dashboardEmailField = "Dashboard Email";

    const formula = `{${dashboardEmailField}}='${escFormulaValue(email)}'`;
    const q = new URLSearchParams({
      filterByFormula: formula,
      maxRecords: "1",
    }).toString();

    const clinics = await airtableGet(`/${baseId}/${encodeURIComponent(clinicsTable)}?${q}`);
    const clinicRec = clinics?.records?.[0];

    if (!clinicRec) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: "No clinic found for this dashboard email in Airtable Clinics table",
          email,
        }),
      };
    }

    const enabled = clinicRec.fields?.["Enabled Features"] || [];
    const name = clinicRec.fields?.["Name"] || "Clinic";

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user: { id: userData.user.id, email },
        clinic: {
          id: clinicRec.id, // IMPORTANT: we use the Airtable record id as clinic id
          name,
          active: !!clinicRec.fields?.["Active"],
          enabled_features: Array.isArray(enabled) ? enabled : [],
        },
      }),
    };
  } catch (e: any) {
    console.error("[me] error", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || "Server error" }),
    };
  }
};