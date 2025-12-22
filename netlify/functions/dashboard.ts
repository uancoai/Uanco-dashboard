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

function formulaClinicLinkContains(clinicId: string, linkedFieldName: string) {
  // linked record fields in Airtable are arrays of record IDs; ARRAYJOIN makes it searchable
  return `FIND('${clinicId}', ARRAYJOIN({${linkedFieldName}}))`;
}

export const handler: Handler = async (event) => {
  try {
    const token = getBearerToken(event);
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing Bearer token" }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid session token" }) };
    }

    const baseId = process.env.AIRTABLE_BASE_ID!;
    if (!baseId) return { statusCode: 500, body: JSON.stringify({ error: "Missing AIRTABLE_BASE_ID" }) };

    const clinicsTable = process.env.AIRTABLE_TABLE_CLINICS || "Clinics";
    const prescreensTable = process.env.AIRTABLE_TABLE_PRESCREENS || "PreScreens";
    const dropoffsTable = process.env.AIRTABLE_TABLE_DROPOFFS || "PreScreen_DropOffs";
    const questionsTable = process.env.AIRTABLE_TABLE_QUESTIONS || "AI_Questions";
    const treatmentsTable = process.env.AIRTABLE_TABLE_TREATMENTS || "Treatments";

    const clinicId = event.queryStringParameters?.clinicId;
    if (!clinicId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing clinicId" }) };
    }

    // Your linked field name (as you confirmed)
    const linkedClinicField = "Clinic Name";

    // Pull pre-screens
    const preFormula = formulaClinicLinkContains(clinicId, linkedClinicField);
    const preQ = new URLSearchParams({
      filterByFormula: preFormula,
      pageSize: "100",
    }).toString();
    const pre = await airtableGet(`/${baseId}/${encodeURIComponent(prescreensTable)}?${preQ}`);

    // Pull drop-offs
    const dropFormula = formulaClinicLinkContains(clinicId, linkedClinicField);
    const dropQ = new URLSearchParams({
      filterByFormula: dropFormula,
      pageSize: "100",
    }).toString();
    const drops = await airtableGet(`/${baseId}/${encodeURIComponent(dropoffsTable)}?${dropQ}`);

    // Pull AI questions
    const qFormula = formulaClinicLinkContains(clinicId, linkedClinicField);
    const qQ = new URLSearchParams({
      filterByFormula: qFormula,
      pageSize: "100",
    }).toString();
    const qs = await airtableGet(`/${baseId}/${encodeURIComponent(questionsTable)}?${qQ}`);

    // Pull treatments
    const tFormula = formulaClinicLinkContains(clinicId, linkedClinicField);
    const tQ = new URLSearchParams({
      filterByFormula: tFormula,
      pageSize: "100",
    }).toString();
    const ts = await airtableGet(`/${baseId}/${encodeURIComponent(treatmentsTable)}?${tQ}`);

    const preScreens = (pre.records || []).map((r: any) => ({ id: r.id, ...r.fields }));
    const dropOffs = (drops.records || []).map((r: any) => ({ id: r.id, ...r.fields }));
    const questions = (qs.records || []).map((r: any) => ({ id: r.id, ...r.fields }));
    const treatments = (ts.records || []).map((r: any) => ({ id: r.id, ...r.fields }));

    // Minimal metrics (expand later)
    const totalPreScreens = preScreens.length;

    const eligibilityField = "eligibility"; // from your table screenshot
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