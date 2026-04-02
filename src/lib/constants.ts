export const CATEGORIES = {
  intimate: { slug: 'intimate', label: 'Intimate', color_hex: '#CF8EE8' },
  active: { slug: 'active', label: 'Active', color_hex: '#7DD47A' },
  playful: { slug: 'playful', label: 'Playful', color_hex: '#F07868' },
  explore: { slug: 'explore', label: 'Explore', color_hex: '#6DB8F0' },
  recharge: { slug: 'recharge', label: 'Recharge', color_hex: '#82C9A0' },
  savor: { slug: 'savor', label: 'Savor', color_hex: '#F0A84A' },
  support: { slug: 'support', label: 'Support', color_hex: '#E89AA8' },
} as const

export type CategorySlug = keyof typeof CATEGORIES

export const GUM_SHAPES = [
  'gum-strip',
  'gum-ball',
  'gum-chiclet',
  'gum-block',
  'gum-blob',
] as const

export type GumShape = (typeof GUM_SHAPES)[number]

export const getCategoryColor = (slug: CategorySlug): string => {
  return CATEGORIES[slug].color_hex
}

export const getRandomShape = (): GumShape => {
  const randomIndex = Math.floor(Math.random() * GUM_SHAPES.length)

  return GUM_SHAPES[randomIndex]
}
