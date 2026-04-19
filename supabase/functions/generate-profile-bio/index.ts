import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type CategorySlug =
  | 'intimate'
  | 'active'
  | 'playful'
  | 'explore'
  | 'recharge'
  | 'savor'
  | 'support'

type CategoryBioTemplate = {
  label: string
  single: string
  context: string
}

const CATEGORY_BIO_TEMPLATES: Record<CategorySlug, CategoryBioTemplate> = {
  intimate: {
    label: 'intimate',
    single:
      'Loves staying in — most of their bridges happen somewhere cozy.',
    context: 'somewhere cozy',
  },
  active: {
    label: 'active',
    single:
      'Gets outside whenever possible — most of their bridges happen moving.',
    context: 'moving',
  },
  playful: {
    label: 'playful',
    single:
      'Lives for creative energy — most of their bridges happen making something.',
    context: 'making something',
  },
  explore: {
    label: 'explore',
    single:
      'Always exploring — most of their bridges happen somewhere new.',
    context: 'somewhere new',
  },
  recharge: {
    label: 'recharge',
    single:
      'Prioritizes rest and renewal — most of their bridges happen at a slower pace.',
    context: 'at a slower pace',
  },
  savor: {
    label: 'savor',
    single:
      'Loves good food and good company — most of their bridges happen around a table.',
    context: 'around a table',
  },
  support: {
    label: 'support',
    single:
      'Shows up for people — most of their bridges happen when it matters.',
    context: 'when it matters',
  },
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing authorization header.' })
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) {
      return jsonResponse(401, { error: 'Missing bearer token.' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(500, { error: 'Supabase environment is not configured.' })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: authData, error: authError } = await serviceClient.auth.getUser(jwt)
    if (authError || !authData.user) {
      return jsonResponse(401, { error: authError?.message ?? 'Unauthorized.' })
    }

    const userId = authData.user.id
    const { data: bridges, error: bridgesError } = await serviceClient
      .from('bridges')
      .select('category')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)

    if (bridgesError) {
      return jsonResponse(500, { error: bridgesError.message })
    }

    const generatedBio = buildBio(bridges ?? [])
    const { error: updateError } = await serviceClient
      .from('users')
      .update({ bio: generatedBio })
      .eq('id', userId)

    if (updateError) {
      return jsonResponse(500, { error: updateError.message })
    }

    return jsonResponse(200, { bio: generatedBio })
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error.',
    })
  }
})

function buildBio(
  bridges: Array<{
    category: string
  }>,
): string {
  if (bridges.length === 0) {
    return 'New here — no bridges yet.'
  }

  const counts = new Map<CategorySlug, number>()
  for (const bridge of bridges) {
    if (!isCategorySlug(bridge.category)) {
      continue
    }
    counts.set(bridge.category, (counts.get(bridge.category) ?? 0) + 1)
  }

  if (counts.size === 0) {
    return 'New here — no bridges yet.'
  }

  const sortedCategories = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [primaryCategory] = sortedCategories
  const secondaryCategory = sortedCategories[1]?.[0]

  const primaryTemplate = CATEGORY_BIO_TEMPLATES[primaryCategory[0]]
  if (!secondaryCategory) {
    return primaryTemplate.single
  }

  const secondaryTemplate = CATEGORY_BIO_TEMPLATES[secondaryCategory]

  return `Loves ${primaryTemplate.label} and ${secondaryTemplate.label} — most of their bridges happen ${primaryTemplate.context}.`
}

function isCategorySlug(value: string): value is CategorySlug {
  return value in CATEGORY_BIO_TEMPLATES
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
