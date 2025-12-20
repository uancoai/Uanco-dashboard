import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
)

function getBearerToken(headers: Record<string, any>) {
  const h = headers.authorization || headers.Authorization || ''
  const m = String(h).match(/^Bearer\s+(.+)$/i)
  return m?.[1] || null
}

export const handler: Handler = async (event) => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      }
    }

    const token = getBearerToken(event.headers as any)
    if (!token) {
      return {
        statusCode: 401,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Missing Bearer token' }),
      }
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return {
        statusCode: 401,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid session' }),
      }
    }

    const user = userData.user

    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (profErr || !profile?.clinic_id) {
      return {
        statusCode: 403,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'No clinic linked to this user' }),
      }
    }

    const { data: clinic, error: clinicErr } = await supabaseAdmin
      .from('clinics')
      .select('id, name, public_clinic_key, airtable_clinic_record_id, active')
      .eq('id', profile.clinic_id)
      .single()

    if (clinicErr || !clinic) {
      return {
        statusCode: 404,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Clinic not found' }),
      }
    }

    if (clinic.active === false) {
      return {
        statusCode: 403,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Clinic inactive' }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user: { id: user.id, email: user.email },
        clinic: {
          id: clinic.id,
          name: clinic.name,
          active: clinic.active,
          public_clinic_key: clinic.public_clinic_key,
          airtable_clinic_record_id: clinic.airtable_clinic_record_id,
          // you don’t have this column in Supabase yet, so hardcode for now:
          enabled_features: ['overview', 'prescreens', 'ai-insight', 'compliance', 'feedback'],
        },
      }),
    }
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: e?.message || 'Unknown error' }),
    }
  }
}