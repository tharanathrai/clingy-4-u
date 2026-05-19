import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.ts'

export default function Landing() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Loading...</p>
      </main>
    )
  }

  if (user) {
    return <Navigate to="/home" replace />
  }

  const handleGoogleSignIn = async () => {
    setErrorMessage(null)
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch {
      setErrorMessage('Something went wrong - try again.')
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5">
      <section className="w-full max-w-sm text-center">
        <h1 className="font-display text-5xl text-text">clingy 4 u</h1>
        <p className="mt-4 font-body text-base text-text-2">
          Make plans together, then turn them into bridges.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-full bg-accent px-7 py-3.5 font-body text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleGoogleSignIn()}
            disabled={submitting}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.6 2.8-4 2.8-7s-1-5.4-2.8-7l-3.1 2.4c1 .7 1.7 1.7 1.9 2.9H12z"
              />
              <path
                fill="#34A853"
                d="M12 24c2.5 0 4.6-.8 6.1-2.2l-3.1-2.4c-.9.6-2 .9-3.1.9-2.4 0-4.5-1.6-5.2-3.8H3.5v2.4C5 21.8 8.2 24 12 24z"
              />
              <path
                fill="#4A90E2"
                d="M6.8 14.5c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V8.5H3.5C2.9 9.8 2.5 11.3 2.5 12.7s.4 2.9 1 4.2l3.3-2.4z"
              />
              <path
                fill="#FBBC05"
                d="M12 5.1c1.4 0 2.6.5 3.6 1.3l2.7-2.7C16.6 2.1 14.5 1 12 1 8.2 1 5 3.2 3.5 6.1l3.3 2.4c.7-2.2 2.8-3.4 5.2-3.4z"
              />
            </svg>
            <span>{submitting ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>
        </div>

        {errorMessage ? (
          <p className="mt-4 text-sm text-playful">{errorMessage}</p>
        ) : null}
      </section>
    </main>
  )
}
