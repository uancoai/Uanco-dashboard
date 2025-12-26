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

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const handler: Handler = async (event) => {
  try {
    // 1) Require Supabase token (same protection as your other functions)
    const token = getBearerToken(event);
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing Bearer token" }) };
    }

    // 2) Validate token server-side
    const supabaseUrl = mustEnv("SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);

    if (userErr || !userData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid session token" }) };
    }

    // 3) Validate critical env vars (fail loudly)
    const baseId = mustEnv("AIRTABLE_BASE_ID");
    mustEnv("AIRTABLE_PAT");

    // Table env vars are optional because you may hardcode defaults elsewhere,
    // but if they exist, we’ll report them.
    const clinicsTable =
      process.env.AIRTABLE_TABLE_CLINICS || "Clinics";

    // 4) Ping Airtable (lightweight)
    const q = new URLSearchParams({ pageSize: "1" }).toString();
    const data = await airtableGet(`/${baseId}/${encodeURIComponent(clinicsTable)}?${q}`);
    const count = (data?.records || []).length;

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: true,
        ts: new Date().toISOString(),
        authUser: { id: userData.user.id, email: userData.user.email },
        airtable: {
          baseIdSuffix: String(baseId).slice(-6),
          clinicsTable,
          sampleRecordsReturned: count,
        },
      }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: e?.message || "Health check failed",
      }),
    };
  }
};