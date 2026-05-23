import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConnectionRequestSentModal } from '../components/connections/ConnectionRequestSentModal.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { supabase } from '../lib/supabase.ts'
import {
  type ValidateQrIssue,
  type ValidateQrUser,
  mapValidateQrIssue,
  validateQrTokenRequest,
} from '../lib/validateQrToken.ts'

interface ConnectIssue {
  message: string
  type: ValidateQrIssue['type']
  connectedUser?: ValidateQrUser
}

const postAuthReturnToKey = 'postAuthReturnTo'

export default function Connect() {
  const { user, loading, signInWithGoogle } = useAuth()
  const userId = user?.id ?? null
  const [params] = useSearchParams()
  const token = params.get('token')
  const [submitting, setSubmitting] = useState(false)
  const [successUser, setSuccessUser] = useState<ValidateQrUser | null>(null)
  const [requestSent, setRequestSent] = useState(false)
  const [connectIssue, setConnectIssue] = useState<ConnectIssue | null>(null)
  const [submitAttempt, setSubmitAttempt] = useState(0)
  const hasSubmittedRef = useRef(false)

  useEffect(() => {
    hasSubmittedRef.current = false
  }, [submitAttempt, token, userId])

  useEffect(() => {
    if (loading || !userId || !token || successUser || connectIssue || hasSubmittedRef.current) {
      return
    }

    let cancelled = false
    const submitToken = async () => {
      hasSubmittedRef.current = true
      setSubmitting(true)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token

        if (!accessToken) {
          if (!cancelled) {
            setConnectIssue({
              type: 'generic',
              message: 'No active session. Please sign in again.',
            })
            hasSubmittedRef.current = false
          }
          return
        }

        const result = await validateQrTokenRequest({
          token,
          accessToken,
        })

        if (!result.success) {
          if (!cancelled) {
            const issue = mapValidateQrIssue(result.error)
            setConnectIssue(toConnectIssue(issue))
            hasSubmittedRef.current = false
          }
          return
        }

        if (!cancelled) {
          setSuccessUser(result.user)
          setRequestSent(true)
        }
      } catch {
        if (!cancelled) {
          setConnectIssue({
            type: 'generic',
            message: 'Something went wrong — try again.',
          })
          hasSubmittedRef.current = false
        }
      } finally {
        setSubmitting(false)
      }
    }

    void submitToken()
    return () => {
      cancelled = true
    }
  }, [connectIssue, loading, submitAttempt, successUser, token, userId])

  const handleSuccessClose = () => {
    setSuccessUser(null)
  }

  const handleSignIn = async () => {
    if (!token) {
      return
    }
    sessionStorage.setItem(postAuthReturnToKey, `/connect?token=${encodeURIComponent(token)}`)
    await signInWithGoogle()
  }

  const retrySubmit = () => {
    setConnectIssue(null)
    setSuccessUser(null)
    hasSubmittedRef.current = false
    setSubmitAttempt((value) => value + 1)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Loading...</p>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-bg px-5 py-8 text-center text-text">
        <h1 className="app-page-title">Connect</h1>
        <p className="mt-3 text-sm text-text-2">This invite link is missing a token.</p>
        <Link
          to="/add"
          className="mt-6 rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
        >
          Go back
        </Link>
      </main>
    )
  }

  if (!userId) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-bg px-5 py-8 text-center text-text">
        <h1 className="app-page-title">Connect</h1>
        <p className="mt-3 max-w-xs text-sm text-text-2">
          Sign in first so we can send your connection request.
        </p>
        <button
          type="button"
          onClick={() => void handleSignIn()}
          className="mt-8 rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
        >
          Sign in with Google
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-bg px-5 py-8 text-center text-text">
      <h1 className="app-page-title">Connect</h1>

      {submitting ? <p className="mt-6 text-sm text-text-2">Sending request...</p> : null}

      {connectIssue ? (
        <section className="mt-8 w-full rounded-lg border border-white/10 bg-surface p-6 text-left">
          <p className="text-sm text-playful">{connectIssue.message}</p>
          <div className="mt-4 flex items-center gap-2">
            {connectIssue.type === 'already_connected' && connectIssue.connectedUser?.username ? (
              <Link
                to={`/profile/${connectIssue.connectedUser.username}`}
                className="rounded-full bg-accent px-4 py-2 text-xs text-white"
              >
                View profile
              </Link>
            ) : null}
            {(connectIssue.type === 'expired' ||
              connectIssue.type === 'own' ||
              connectIssue.type === 'request_pending') ? (
              <button
                type="button"
                onClick={() => setConnectIssue(null)}
                className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
              >
                Dismiss
              </button>
            ) : null}
            {connectIssue.type === 'generic' ? (
              <button
                type="button"
                onClick={retrySubmit}
                className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
              >
                Retry
              </button>
            ) : null}
            <Link
              to="/home"
              className="rounded-full bg-surface-2 px-4 py-2 text-xs text-text-2"
            >
              Back to app
            </Link>
          </div>
        </section>
      ) : null}

      {requestSent && !successUser && !connectIssue ? (
        <section className="mt-8 w-full rounded-lg border border-white/10 bg-surface p-6 text-center">
          <p className="text-sm text-active">Request sent.</p>
          <p className="mt-2 text-sm text-text-2">They&apos;ll get a notification to accept.</p>
          <Link
            to="/home"
            className="mt-6 inline-block rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
          >
            Go to your pocket
          </Link>
        </section>
      ) : null}

      {!submitting && !successUser && !connectIssue && !requestSent ? (
        <section className="mt-8 w-full rounded-lg border border-white/10 bg-surface p-6 text-center">
          <p className="text-sm text-text-2">Ready to send your connection request.</p>
          <button
            type="button"
            onClick={retrySubmit}
            className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white"
          >
            Send request
          </button>
        </section>
      ) : null}

      <ConnectionRequestSentModal
        open={successUser !== null}
        user={successUser}
        onClose={handleSuccessClose}
      />
    </main>
  )
}

function toConnectIssue(issue: ValidateQrIssue): ConnectIssue {
  return {
    message: issue.message,
    type: issue.type,
    connectedUser: issue.connectedUser,
  }
}
