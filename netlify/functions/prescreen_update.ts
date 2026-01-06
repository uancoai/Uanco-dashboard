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

async function airtablePatch(path: string, body: any) {
  const res = await fetch(`${AIRTABLE_API}${path}`, {
    method: "PATCH",
    headers: airtableHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Airtable error ${res.status}: ${text}`);
  return JSON.parse(text);
}

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      // CORS (safe default)
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  try {
    // Preflight
    if (event.httpMethod === "OPTIONS") {
      return json(200, { ok: true });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    // 1) Require Supabase token
    const token = getBearerToken(event);
    if (!token) return json(401, { error: "Missing Bearer token" });

    // 2) Validate token server-side
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Missing Supabase server env vars" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { error: "Invalid session token" });

    // 3) Airtable env
    const baseId = process.env.AIRTABLE_BASE_ID!;
    if (!baseId) return json(500, { error: "Missing AIRTABLE_BASE_ID" });

    const prescreensTable = process.env.AIRTABLE_TABLE_PRESCREENS || "PreScreens";

    // 4) Parse body safely
    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const { id, updates } = parsed || {};
    if (!id || !updates) return json(400, { error: "Missing id or updates" });

    // 5) Allow-list updates (so UI changes persist after refresh)
    // We accept multiple possible keys from the frontend, but only write safe fields to Airtable.
    const fields: Record<string, any> = {};

    // ---- Booking status ----
    const booking =
      updates.booking_status ??
      updates["booking_status"] ??
      updates["Booking Status"] ??
      updates["Booking Status (Dashboard)"];
    if (booking !== undefined) {
      if (booking !== "Booked" && booking !== "Pending") {
        return json(400, { error: "booking_status must be 'Booked' or 'Pending'" });
      }
      // IMPORTANT: must match Airtable field name EXACTLY
      // Dashboard-specific field (not mapped from Landbot/Make)
      fields["booking_status"] = booking;
    }

    // ---- Review complete (checkbox) ----
    const reviewComplete =
      updates.review_complete ??
      updates.reviewComplete ??
      updates["Review Complete"];

    if (reviewComplete !== undefined) {
      // Airtable checkbox expects boolean
      if (typeof reviewComplete !== "boolean") {
        return json(400, { error: "review_complete must be a boolean" });
      }
      // IMPORTANT: must match Airtable field name EXACTLY
      fields["Review Complete"] = reviewComplete;
    }

    // Nothing to update
    if (Object.keys(fields).length === 0) {
      return json(400, { error: "No supported updates provided" });
    }

    const result = await airtablePatch(
      `/${baseId}/${encodeURIComponent(prescreensTable)}/${encodeURIComponent(id)}`,
      { fields }
    );

    return json(200, { ok: true, record: result });
  } catch (e: any) {
    return json(500, { error: e?.message || "Server error" });
  }
};