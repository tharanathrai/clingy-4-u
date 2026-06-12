import type { CSSProperties } from 'react'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import { type GumMorphClass, GUM_MORPH_CLASSES } from '../../lib/gumMorph.ts'

export type GumBlobVariant = 'settled' | 'floating' | 'matte'

export type GumBlobSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeClass: Record<GumBlobSize, string> = {
  sm: 'gum-blob-sm',
  md: 'gum-blob-md',
  lg: 'gum-blob-lg',
  xl: 'gum-blob-xl',
}

interface GumBlobProps {
  category: CategorySlug
  size?: GumBlobSize
  morphClass?: GumMorphClass
  variant?: GumBlobVariant
  className?: string
  ariaHidden?: boolean
}

export function GumBlob({
  category,
  size = 'md',
  morphClass = GUM_MORPH_CLASSES[1],
  variant = 'settled',
  className = '',
  ariaHidden = true,
}: GumBlobProps) {
  const color = CATEGORIES[category].color_hex
  const style = { '--gum-color': color } as CSSProperties

  return (
    <div
      className={`gum-blob ${sizeClass[size]} gum-blob-${variant} ${className}`}
      style={style}
      aria-hidden={ariaHidden ? true : undefined}
    >
      <div className={`gum-blob-core gum-morph-base ${morphClass}`} />
      <div className="gum-blob-specular" />
      <div className="gum-blob-rim" />
      <div className="gum-blob-drip" />
    </div>
  )
}
