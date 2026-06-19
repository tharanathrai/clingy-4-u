interface SpinnerProps {
  size?: number
  className?: string
}

/** Branded loading spinner — accent gum-lilac ring. */
export function Spinner({ size = 28, className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-white/10 border-t-accent ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

/** Full-screen centered branded spinner — the canonical route/page loading state. */
export function FullScreenSpinner() {
  return (
    <div className="safe-screen-height mx-auto flex w-full max-w-md items-center justify-center bg-bg">
      <Spinner size={32} />
    </div>
  )
}
