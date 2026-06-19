import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pseudonymize, sanitizeBatch } from '../_shared/analytics.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface TrackBody {
  events?: unknown
  install_id?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const analyticsSalt = Deno.env.get('ANALYTICS_SALT')
    if (!supabaseUrl || !supabaseServiceRoleKey || !analyticsSalt) {
      return jsonResponse(500, { error: 'Analytics environment is not configured.' })
    }

    const payload = (await request.json()) as TrackBody
    const events = sanitizeBatch(payload.events)
    if (events.length === 0) {
      // Nothing valid to record; succeed quietly so the client doesn't retry.
      return jsonResponse(200, { accepted: 0 })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Resolve the subject id: prefer the authenticated user, else the anonymous
    // install_id. Either way it is HMAC-hashed before storage — never stored raw.
    let subjectId = typeof payload.install_id === 'string' ? payload.install_id.trim() : ''
    const authHeader = request.headers.get('Authorization')
    if (authHeader) {
      const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (jwt) {
        const { data: authData } = await serviceClient.auth.getUser(jwt)
        if (authData.user) {
          subjectId = authData.user.id
        }
      }
    }
    if (!subjectId) {
      return jsonResponse(400, { error: 'missing_subject' })
    }

    const pseudonym = await pseudonymize(subjectId, analyticsSalt)

    // Note: we deliberately do NOT read x-forwarded-for / client IP.
    const rows = events.map((e) => ({
      pseudonym,
      session_id: e.session_id,
      event_name: e.event_name,
      surface: e.surface,
      props: e.props,
      platform: e.platform,
      app_version: e.app_version,
    }))

    const { error: insertError } = await serviceClient.from('analytics_events').insert(rows)
    if (insertError) {
      return jsonResponse(500, { error: insertError.message })
    }

    return jsonResponse(200, { accepted: rows.length })
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error.',
    })
  }
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
