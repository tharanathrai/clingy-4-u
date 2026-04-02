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
            className="w-full rounded-full bg-accent px-7 py-3.5 font-body text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleGoogleSignIn()}
            disabled={submitting}
          >
            {submitting ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>

        {errorMessage ? (
          <p className="mt-4 text-sm text-playful">{errorMessage}</p>
        ) : null}
      </section>
    </main>
  )
}
