import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type CategoryConfig = {
  slug: string
  color_hex: string
  keywords: string[]
}

interface CreateGumPieceBody {
  recipient_id?: string
  title?: string
}

const gumShapes = [
  'gum-strip',
  'gum-ball',
  'gum-chiclet',
  'gum-block',
  'gum-blob',
] as const

const categories: CategoryConfig[] = [
  {
    slug: 'intimate',
    color_hex: '#CF8EE8',
    keywords: [
      'sleepover',
      'night in',
      'movie',
      'tv',
      'chill',
      'cozy',
      'girls night',
      'game night',
      'board game',
      'netflix',
      'cuddle',
      'stay in',
    ],
  },
  {
    slug: 'active',
    color_hex: '#7DD47A',
    keywords: [
      'hike',
      'bike',
      'cycle',
      'walk',
      'run',
      'climb',
      'kayak',
      'swim',
      'park',
      'trail',
      'outdoor',
      'camp',
      'sport',
      'gym',
      'workout',
    ],
  },
  {
    slug: 'playful',
    color_hex: '#F07868',
    keywords: [
      'paint',
      'draw',
      'music',
      'concert',
      'art',
      'craft',
      'make',
      'build',
      'studio',
      'shoot',
      'photo',
      'creative',
      'comedy',
      'karaoke',
    ],
  },
  {
    slug: 'explore',
    color_hex: '#6DB8F0',
    keywords: [
      'travel',
      'trip',
      'road',
      'visit',
      'museum',
      'gallery',
      'market',
      'festival',
      'show',
      'tour',
      'explore',
      'discover',
    ],
  },
  {
    slug: 'recharge',
    color_hex: '#82C9A0',
    keywords: [
      'yoga',
      'spa',
      'meditate',
      'pilates',
      'stretch',
      'class',
      'breathe',
      'sauna',
      'float',
      'massage',
      'wellness',
    ],
  },
  {
    slug: 'savor',
    color_hex: '#F0A84A',
    keywords: [
      'dinner',
      'lunch',
      'brunch',
      'breakfast',
      'café',
      'coffee',
      'cook',
      'bake',
      'restaurant',
      'eat',
      'drinks',
      'bar',
      'wine',
      'food',
      'tasting',
    ],
  },
  {
    slug: 'support',
    color_hex: '#E89AA8',
    keywords: [
      'help',
      'move',
      'support',
      'show up',
      'be there',
      'hospital',
      'appointment',
      'pick up',
      'drop off',
      'errand',
    ],
  },
]

const defaultCategory = categories.find((category) => category.slug === 'explore') as CategoryConfig

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

    const body = (await request.json()) as CreateGumPieceBody
    const recipientId = body.recipient_id?.trim()
    const title = body.title?.trim()

    if (!title) {
      return jsonResponse(400, { error: 'title_required' })
    }

    if (title.length > 60) {
      return jsonResponse(400, { error: 'title_too_long' })
    }

    if (!recipientId) {
      return jsonResponse(400, { error: 'recipient_required' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(500, { error: 'Supabase environment is not configured.' })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    })

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return jsonResponse(401, { error: authError?.message ?? 'Unauthorized.' })
    }

    const userId = authData.user.id
    if (recipientId === userId) {
      return jsonResponse(400, { error: 'recipient_required' })
    }

    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id')
      .eq('status', 'active')
      .or(
        `and(user_a_id.eq.${userId},user_b_id.eq.${recipientId}),and(user_a_id.eq.${recipientId},user_b_id.eq.${userId})`,
      )
      .maybeSingle()

    if (connectionError) {
      return jsonResponse(500, { error: connectionError.message })
    }

    if (!connection) {
      return jsonResponse(400, { error: 'connection_required' })
    }

    const categorized = categorizeTitle(title)

    const { count: globalCount, error: globalCountError } = await supabase
      .from('gum_pieces')
      .select('id', { count: 'exact', head: true })
      .in('status', ['placeholder', 'active'])
      .or(`creator_id.eq.${userId},recipient_id.eq.${userId}`)

    if (globalCountError) {
      return jsonResponse(500, { error: globalCountError.message })
    }

    const safeGlobalCount = globalCount ?? 0
    if (safeGlobalCount >= 25) {
      return jsonResponse(400, {
        error: 'slot_limit_global',
        count: safeGlobalCount,
      })
    }

    const pairFilter = `and(creator_id.eq.${userId},recipient_id.eq.${recipientId}),and(creator_id.eq.${recipientId},recipient_id.eq.${userId})`
    const { count: pairCount, error: pairCountError } = await supabase
      .from('gum_pieces')
      .select('id', { count: 'exact', head: true })
      .in('status', ['placeholder', 'active'])
      .or(pairFilter)

    if (pairCountError) {
      return jsonResponse(500, { error: pairCountError.message })
    }

    const safePairCount = pairCount ?? 0
    if (safePairCount >= 5) {
      return jsonResponse(400, {
        error: 'slot_limit_pair',
        count: safePairCount,
      })
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const shape = getRandomShape()
    const { data: createdPiece, error: createPieceError } = await supabase
      .from('gum_pieces')
      .insert({
        creator_id: userId,
        recipient_id: recipientId,
        title,
        category: categorized.slug,
        color_hex: categorized.color_hex,
        shape,
        status: 'placeholder',
        expires_at: expiresAt,
      })
      .select('id, title, category, color_hex, status, expires_at')
      .single()

    if (createPieceError || !createdPiece) {
      return jsonResponse(500, { error: createPieceError?.message ?? 'Failed to create gum piece.' })
    }

    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'invite_received',
      reference_id: createdPiece.id,
      read: false,
    })

    if (notificationError) {
      return jsonResponse(500, { error: notificationError.message })
    }

    return jsonResponse(200, {
      gum_piece: createdPiece,
    })
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error.',
    })
  }
})

function categorizeTitle(title: string): CategoryConfig {
  const loweredTitle = title.toLowerCase()
  const words = loweredTitle.split(/\s+/).filter(Boolean)
  const wordSet = new Set(words)

  let highestScore = 0
  let winner: CategoryConfig = defaultCategory
  let isTie = false

  for (const category of categories) {
    let score = 0

    for (const keyword of category.keywords) {
      const normalizedKeyword = keyword.toLowerCase()
      if (normalizedKeyword.includes(' ')) {
        if (loweredTitle.includes(normalizedKeyword)) {
          score += 1
        }
        continue
      }

      if (wordSet.has(normalizedKeyword)) {
        score += 1
      }
    }

    if (score > highestScore) {
      highestScore = score
      winner = category
      isTie = false
      continue
    }

    if (score > 0 && score === highestScore) {
      isTie = true
    }
  }

  if (highestScore === 0 || isTie) {
    return defaultCategory
  }

  return winner
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getRandomShape(): (typeof gumShapes)[number] {
  const index = Math.floor(Math.random() * gumShapes.length)
  return gumShapes[index]
}
