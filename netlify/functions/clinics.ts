import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnon = process.env.SUPABASE_ANON_KEY!;
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getBearerToken(event: any) {
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

export const handler: Handler = async (event) => {
  try {
    const token = getBearerToken(event);
    if (!token) return { statusCode: 401, body: "Missing auth token" };

    // 1) Get user from token (anon client can do this)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon);
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData?.user) return { statusCode: 401, body: "Invalid token" };

    const uid = userData.user.id;

    // 2) Use service role to read profiles/clinics (server-side only)
    const supabaseAdmin = createClient(supabaseUrl, supabaseService);

    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .single();

    if (profErr) return { statusCode: 500, body: "Profile lookup failed" };
    if (profile?.role !== "super_admin") return { statusCode: 403, body: "Forbidden" };

    const { data: clinics, error: cErr } = await supabaseAdmin
      .from("clinics")
      .select("id, public_clinic_key, airtable_clinic_record_id, active, name")
      .order("created_at", { ascending: true });

    if (cErr) return { statusCode: 500, body: "Clinic list failed" };

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clinics }),
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Unknown error" };
  }
};