const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface SendEmailBody {
  to?: string
  subject?: string
  body?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'
    if (!serviceRoleKey || !resendApiKey) {
      return jsonResponse(500, { error: 'Missing server configuration.' })
    }

    const authHeader = request.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token || token !== serviceRoleKey) {
      return jsonResponse(401, { error: 'unauthorized' })
    }

    const payload = (await request.json()) as SendEmailBody
    const to = payload.to?.trim()
    const subject = payload.subject?.trim()
    const body = payload.body?.trim()

    if (!to || !subject || !body) {
      return jsonResponse(400, { error: 'invalid_payload' })
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        text: body,
      }),
    })

    if (!response.ok) {
      const resendBody = await response.text()
      return jsonResponse(500, {
        error: 'resend_error',
        details: resendBody,
      })
    }

    return jsonResponse(200, { success: true })
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
