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
        {/* multi-colour bloom */}
        <span
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: '-70%',
            background: 'radial-gradient(circle at 38% 38%, rgba(207,142,232,0.4) 0%, rgba(109,184,240,0.28) 28%, rgba(240,168,74,0.2) 55%, rgba(240,120,104,0.12) 75%, transparent 90%)',
            filter: 'blur(8px)',
          }}
        />
        {/* screen-blended prismatic blob */}
        <span
          aria-hidden
          className="relative w-full h-full overflow-hidden gum-morph-base gum-morph-42"
          style={{
            background: 'conic-gradient(from 0deg, #CF8EE8, #6DB8F0, #82C9A0, #7DD47A, #F0A84A, #F07868, #E89AA8, #CF8EE8)',
            mixBlendMode: 'screen',
            opacity: 0.45,
          }}
        >
          {/* shimmer sweep */}
          <span
            aria-hidden
            className="es-blob-shimmer absolute inset-y-0 pointer-events-none"
            style={{
              width: '40%',
              background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
            }}
          />
        </span>
      </span>
    </div>
  )
}
