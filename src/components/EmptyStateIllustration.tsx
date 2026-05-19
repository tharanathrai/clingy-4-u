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
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className="mx-auto h-16 w-16 text-accent/80"
    >
      <path
        d="M48 10 C65 8, 82 20, 84 38 C86 56, 77 75, 59 83 C43 90, 21 85, 13 70 C6 57, 9 38, 19 25 C27 15, 37 11, 48 10 Z"
        fill="currentColor"
      />
      <circle cx="63" cy="30" r="6" fill="#F2EFF8" fillOpacity="0.5" />
    </svg>
  )
}
