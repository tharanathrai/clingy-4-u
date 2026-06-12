import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { CategorySlug } from '../../lib/constants.ts'

type LiquidButtonVariant = 'primary' | 'secondary' | 'blob'

interface LiquidButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: LiquidButtonVariant
  category?: CategorySlug
  children: ReactNode
}

export function LiquidButton({
  variant = 'primary',
  category,
  children,
  className = '',
  ...rest
}: LiquidButtonProps) {
  const variantClass =
    variant === 'blob'
      ? 'btn-liquid-blob'
      : variant === 'secondary'
        ? 'btn-liquid-secondary'
        : 'btn-liquid-primary'

  const categoryClass = category ? `btn-liquid-category-${category}` : ''

  return (
    <button
      className={`${variantClass} ${categoryClass} ${className}`.trim()}
      {...rest}
    >
      <span className="btn-liquid-sheen" aria-hidden />
      {children}
    </button>
  )
}
