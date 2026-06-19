import { Link } from 'react-router-dom'
import { EmptyStateIllustration } from './EmptyStateIllustration.tsx'

interface EmptyStateProps {
  variant?: 'gum' | 'bridge'
  headline: string
  subline?: string
  cta?: { label: string; to: string }
  /** Wrap in a surface card (default). Set false to render bare over a custom backdrop. */
  framed?: boolean
}

/** Canonical empty state — illustration, headline, subline, and a nudge CTA. */
export function EmptyState({
  variant = 'gum',
  headline,
  subline,
  cta,
  framed = true,
}: EmptyStateProps) {
  const inner = (
    <>
      <EmptyStateIllustration variant={variant} />
      <h2 className="mt-4 font-display text-3xl text-text">{headline}</h2>
      {subline ? <p className="mt-2 text-sm text-text-2">{subline}</p> : null}
      {cta ? (
        <Link
          to={cta.to}
          className="btn-primary mt-5 inline-block rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
        >
          {cta.label}
        </Link>
      ) : null}
    </>
  )

  if (!framed) {
    return <div className="text-center">{inner}</div>
  }

  return (
    <section className="mt-8 rounded-lg bg-surface p-8 text-center">{inner}</section>
  )
}
