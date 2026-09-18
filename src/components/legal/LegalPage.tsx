import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackHeader } from '../layout/BackHeader.tsx'
import { pageShellScroll } from '../layout/pageShell.ts'
import { fieldLabelClass, sectionHeadingClass } from '../../lib/typography.ts'

/** Shown as the contact address on both legal pages and on the Google consent screen. */
export const LEGAL_CONTACT_EMAIL = 'traiofficial1@gmail.com'

/** Bump whenever the text of either legal page changes. */
export const LEGAL_LAST_UPDATED = '18 September 2026'

interface LegalPageProps {
  title: string
  intro: ReactNode
  children: ReactNode
}

export function LegalPage({ title, intro, children }: LegalPageProps) {
  const navigate = useNavigate()

  // Deep links (Google's review, a shared URL) have no history to pop, so fall
  // back to the landing page instead of leaving the app.
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <main className={pageShellScroll}>
      <BackHeader onBack={handleBack} />
      <h1 className="font-display mt-4 text-3xl text-text">{title}</h1>
      <p className={`mt-2 ${fieldLabelClass}`}>Last updated {LEGAL_LAST_UPDATED}</p>
      <p className="mt-4 text-sm leading-relaxed text-text-2">{intro}</p>
      <div className="mt-5 space-y-4">{children}</div>
      <p className="mt-6 text-xs leading-relaxed text-text-3">
        Questions about this page? Email{' '}
        <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>
    </main>
  )
}

interface LegalSectionProps {
  heading: string
  children: ReactNode
}

export function LegalSection({ heading, children }: LegalSectionProps) {
  return (
    <section className="rounded-lg bg-surface p-5">
      <h2 className={sectionHeadingClass}>{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-text-2">{children}</div>
    </section>
  )
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>
}
