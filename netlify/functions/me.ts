import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

export const handler: Handler = async (event) => {
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          error: 'Missing Supabase env vars in Netlify Functions runtime',
          expected: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
          got: {
            has_SUPABASE_URL: !!process.env.SUPABASE_URL,
            has_SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
            has_VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
            has_VITE_SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY,
          },
        }),
      }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const authHeader =
      event.headers.authorization || event.headers.Authorization || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return {
        statusCode: 401,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Missing Bearer token' }),
      }
    }

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      return {
        statusCode: 401,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: false, error: error?.message || 'Unauthorized' }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, user: { id: data.user.id, email: data.user.email } }),
    }
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err?.message || 'Unknown error' }),
    }
  }
}