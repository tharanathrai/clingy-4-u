export type CategoryConfig = {
  slug: string
  color_hex: string
  keywords: string[]
}

export const categories: CategoryConfig[] = [
  {
    slug: 'intimate',
    color_hex: '#CF8EE8',
    keywords: [
      'sleepover',
      'night in',
      'movie night',
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
      'hang out',
      'hangout',
      'catch up',
      'talk',
      'chat',
      'vent',
      'listen',
    ],
  },
  {
    slug: 'active',
    color_hex: '#7DD47A',
    keywords: [
      'hike',
      'hiking',
      'bike',
      'biking',
      'cycle',
      'cycling',
      'walk',
      'walking',
      'run',
      'running',
      'climb',
      'climbing',
      'kayak',
      'swim',
      'swimming',
      'park',
      'trail',
      'outdoor',
      'camp',
      'camping',
      'sport',
      'sports',
      'gym',
      'workout',
      'tennis',
      'soccer',
      'basketball',
      'ski',
      'skate',
      'surf',
      'dance',
      'dancing',
      'pickleball',
    ],
  },
  {
    slug: 'playful',
    color_hex: '#F07868',
    keywords: [
      'paint',
      'painting',
      'draw',
      'drawing',
      'music',
      'concert',
      'art',
      'craft',
      'crafting',
      'studio',
      'shoot',
      'photo',
      'photography',
      'creative',
      'comedy',
      'karaoke',
      'bowling',
      'arcade',
      'trivia',
      'party',
      'birthday',
      'celebrate',
      'game',
      'games',
      'play',
    ],
  },
  {
    slug: 'explore',
    color_hex: '#6DB8F0',
    keywords: [
      'travel',
      'trip',
      'road trip',
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
      'sightsee',
      'city',
      'downtown',
      'bookstore',
      'library',
      'shop',
      'shopping',
    ],
  },
  {
    slug: 'recharge',
    color_hex: '#82C9A0',
    keywords: [
      'yoga',
      'spa',
      'meditate',
      'meditation',
      'pilates',
      'stretch',
      'breathe',
      'sauna',
      'float',
      'massage',
      'wellness',
      'rest',
      'nap',
      'recover',
      'unwind',
      'journal',
      'therapy',
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
      'cafe',
      'café',
      'coffee',
      'tea',
      'cook',
      'cooking',
      'bake',
      'baking',
      'restaurant',
      'eat',
      'eating',
      'drinks',
      'drink',
      'bar',
      'wine',
      'beer',
      'food',
      'tasting',
      'pizza',
      'sushi',
      'tacos',
      'ramen',
      'picnic',
      'potluck',
      'meal',
      'grab',
      'bite',
    ],
  },
  {
    slug: 'support',
    color_hex: '#E89AA8',
    keywords: [
      'help',
      'moving',
      'move',
      'support',
      'show up',
      'be there',
      'hospital',
      'appointment',
      'pick up',
      'drop off',
      'errand',
      'errands',
      'drive',
      'babysit',
      'pet sit',
      'check in',
    ],
  },
]

const defaultCategory = categories.find((category) => category.slug === 'explore') as CategoryConfig

const tieBreakPriority = [
  'intimate',
  'savor',
  'active',
  'playful',
  'recharge',
  'support',
  'explore',
] as const

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '')
}

function scoreKeyword(loweredTitle: string, words: string[], keyword: string): number {
  const normalizedKeyword = keyword.toLowerCase()

  if (normalizedKeyword.includes(' ')) {
    return loweredTitle.includes(normalizedKeyword) ? 3 : 0
  }

  for (const word of words) {
    const normalizedWord = normalizeWord(word)
    if (!normalizedWord) {
      continue
    }

    if (normalizedWord === normalizedKeyword) {
      return 2
    }

    if (
      normalizedKeyword.length >= 4 &&
      (normalizedWord.includes(normalizedKeyword) ||
        normalizedKeyword.includes(normalizedWord))
    ) {
      return 1
    }

    if (
      normalizedKeyword.length >= 3 &&
      normalizedWord.startsWith(normalizedKeyword)
    ) {
      return 1
    }
  }

  const boundaryPattern = new RegExp(
    `\\b${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
  )
  return boundaryPattern.test(loweredTitle) ? 1 : 0
}

export function categorizeTitle(title: string): CategoryConfig {
  const loweredTitle = title.toLowerCase().trim()
  const words = loweredTitle.split(/\s+/).filter(Boolean)

  const scores = new Map<string, number>()
  for (const category of categories) {
    let score = 0
    for (const keyword of category.keywords) {
      score += scoreKeyword(loweredTitle, words, keyword)
    }
    scores.set(category.slug, score)
  }

  let highestScore = 0
  const contenders: CategoryConfig[] = []

  for (const category of categories) {
    const score = scores.get(category.slug) ?? 0
    if (score > highestScore) {
      highestScore = score
      contenders.length = 0
      contenders.push(category)
      continue
    }

    if (score > 0 && score === highestScore) {
      contenders.push(category)
    }
  }

  if (highestScore === 0) {
    return defaultCategory
  }

  if (contenders.length === 1) {
    return contenders[0]
  }

  for (const slug of tieBreakPriority) {
    const match = contenders.find((category) => category.slug === slug)
    if (match) {
      return match
    }
  }

  return defaultCategory
}
