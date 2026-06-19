interface EmptyStateIllustrationProps {
  variant?: 'gum' | 'bridge'
}

export function EmptyStateIllustration({
  variant = 'gum',
}: EmptyStateIllustrationProps) {
  if (variant === 'bridge') {
    return (
      <svg
        viewBox="0 0 120 80"
        aria-hidden="true"
        className="mx-auto h-16 w-24 text-accent/80"
      >
        <circle cx="20" cy="58" r="10" fill="currentColor" />
        <circle cx="100" cy="58" r="10" fill="currentColor" />
        <path
          d="M20 58 C36 24, 84 24, 100 58"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <div className="mx-auto flex justify-center">
      <span
        className="es-blob-hue-spin relative inline-grid place-items-center shrink-0"
        style={{ width: 80, height: 80 }}
      >
        <span
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: '-40%',
            background: 'radial-gradient(circle at center, rgba(207,142,232,0.18) 0%, transparent 70%)',
          }}
        />
        <span
          aria-hidden
          className="relative w-full h-full overflow-hidden shadow-gloss-gum gum-morph-base gum-morph-42"
          style={{ background: 'rgba(255, 255, 255, 0.68)' }}
        >
          <span
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, #CF8EE8, #6DB8F0, #82C9A0, #7DD47A, #F0A84A, #F07868, #E89AA8, #CF8EE8)',
              opacity: 0.22,
            }}
          />
          <span
            aria-hidden
            className="absolute pointer-events-none rounded-full"
            style={{
              top: '12%',
              left: '14%',
              width: '42%',
              height: '34%',
              background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85), transparent 70%)',
            }}
          />
        </span>
      </span>
    </div>
  )
}
