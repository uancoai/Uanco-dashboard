import type { Handler } from "@netlify/functions";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const handler: Handler = async () => {
  try {
    // Public health check: NO auth, just confirms the function is alive + env exists
    const baseId = mustEnv("AIRTABLE_BASE_ID");
    mustEnv("AIRTABLE_PAT");
    mustEnv("SUPABASE_URL");
    mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: true,
        ts: new Date().toISOString(),
        env: {
          airtableBaseIdSuffix: String(baseId).slice(-6),
        },
      }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: e?.message || "Health check failed" }),
    };
  }
};