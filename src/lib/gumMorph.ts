export const GUM_MORPH_CLASSES = ['gum-morph-3', 'gum-morph-37', 'gum-morph-42'] as const

export type GumMorphClass = (typeof GUM_MORPH_CLASSES)[number]

export function gumMorphClassFromId(id: string): GumMorphClass {
  let total = 0
  for (let index = 0; index < id.length; index += 1) {
    total += id.charCodeAt(index)
  }

  return GUM_MORPH_CLASSES[total % GUM_MORPH_CLASSES.length]
}
