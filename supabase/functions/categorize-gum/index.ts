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

interface CategorizeBody {
  title?: string
}

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

    const body = (await request.json()) as CategorizeBody
    const title = body.title?.trim()

    if (!title) {
      return jsonResponse(400, { error: 'Missing title.' })
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

    const result = categorizeTitle(title)

    return jsonResponse(200, {
      category: result.slug,
      color_hex: result.color_hex,
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
