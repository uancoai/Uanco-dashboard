// netlify/functions/failed.js

export const handler = async (event) => {
  try {
    // Optional auth check – mirror your existing protected endpoints if needed
    // Example:
    // const authHeader = event.headers.authorization || event.headers.Authorization;
    // if (!authHeader) {
    //   return { statusCode: 401, body: JSON.stringify({ error: "Missing Authorization header" }) };
    // }

    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID environment variables",
        }),
      };
    }

    const TABLE_NAME = "PreScreen_DropOffs";
    const VIEW_NAME = "DASH – Failed (Canonical)";

    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
    );
    url.searchParams.set("view", VIEW_NAME);
    url.searchParams.set("pageSize", "50");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Airtable request failed",
          details: data,
        }),
      };
    }

    const records = (data.records || []).map((record) => ({
      id: record.id,
      ...record.fields,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ records }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Unexpected server error",
      }),
    };
  }
};
