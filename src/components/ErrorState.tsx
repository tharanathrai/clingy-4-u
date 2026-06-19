interface ErrorStateProps {
  message: string
  onRetry: () => void
  /** Wrap in a surface card (default). Set false to render bare over a custom backdrop. */
  framed?: boolean
}

/** Canonical load-failure state — warm copy, consistent Try again control. */
export function ErrorState({ message, onRetry, framed = true }: ErrorStateProps) {
  const inner = (
    <>
      <p className="text-sm text-text-2">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
      >
        Try again
      </button>
    </>
  )

  if (!framed) {
    return <div className="text-center">{inner}</div>
  }

  return (
    <section className="mt-8 rounded-lg bg-surface p-6 text-center">{inner}</section>
  )
}
