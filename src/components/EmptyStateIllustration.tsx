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
    <svg viewBox="0 0 96 100" aria-hidden="true" className="mx-auto h-20 w-20">
      <defs>
        <radialGradient id="es-blob-body" cx="35%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#EDD5FF" />
          <stop offset="50%" stopColor="#CF8EE8" />
          <stop offset="100%" stopColor="#7A3DB5" />
        </radialGradient>
        <radialGradient id="es-blob-gloss" cx="38%" cy="30%" r="45%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.68" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="es-blob-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="48" cy="93" rx="20" ry="4" fill="url(#es-blob-shadow)" />
      <path
        d="M48 10 C65 8, 82 20, 84 38 C86 56, 77 75, 59 83 C43 90, 21 85, 13 70 C6 57, 9 38, 19 25 C27 15, 37 11, 48 10 Z"
        fill="url(#es-blob-body)"
      />
      <path
        d="M48 10 C65 8, 82 20, 84 38 C86 56, 77 75, 59 83 C43 90, 21 85, 13 70 C6 57, 9 38, 19 25 C27 15, 37 11, 48 10 Z"
        fill="url(#es-blob-gloss)"
      />
      <ellipse
        cx="34" cy="26" rx="11" ry="6.5"
        transform="rotate(-20 34 26)"
        fill="white"
        fillOpacity="0.42"
      />
    </svg>
  )
}
