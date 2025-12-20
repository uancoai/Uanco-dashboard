import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

function getBearerToken(headers: Record<string, string | undefined>) {
  const auth = headers.authorization || headers.Authorization
  if (!auth) return null
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

export const handler: Handler = async (event) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      }
    }

    const token = getBearerToken(event.headers as any)
    if (!token) {
      return {
        statusCode: 401,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Missing Authorization Bearer token' }),
      }
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return {
        statusCode: 401,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid session token' }),
      }
    }

    const user = userData.user

    // profile -> clinic
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, clinic_id')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile?.clinic_id) {
      return {
        statusCode: 403,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'No profile/clinic linked to this user' }),
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
          public_clinic_key: clinic.public_clinic_key,
          airtable_clinic_record_id: clinic.airtable_clinic_record_id,
          active: clinic.active,
          enabled_features: ['overview', 'prescreens', 'ai-insight', 'compliance', 'feedback'],
        },
      }),
    }
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Unknown error' }),
    }
  }
}