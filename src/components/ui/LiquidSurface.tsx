import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

type LiquidSurfaceOwnProps<T extends ElementType> = {
  as?: T
  elevated?: boolean
  children: ReactNode
  className?: string
}

export type LiquidSurfaceProps<T extends ElementType = 'div'> = LiquidSurfaceOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof LiquidSurfaceOwnProps<T>>

export function LiquidSurface<T extends ElementType = 'div'>({
  as,
  elevated = false,
  children,
  className = '',
  ...rest
}: LiquidSurfaceProps<T>) {
  const Component = as ?? 'div'
  const surfaceClass = elevated ? 'liquid-surface-elevated' : 'liquid-surface'

  return (
    <Component className={`${surfaceClass} ${className}`.trim()} {...rest}>
      <span className="liquid-surface-sheen" aria-hidden />
      {children}
    </Component>
  )
}
