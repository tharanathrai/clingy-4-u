import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConnectionRequestSentModal } from '../components/connections/ConnectionRequestSentModal.tsx'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { pageShellJourneyScroll } from '../components/layout/pageShell.ts'
import { FullScreenSpinner } from '../components/Spinner.tsx'
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
    return <FullScreenSpinner />
  }

  if (!token) {
    return (
      <main className={pageShellJourneyScroll}>
        <BackHeader to="/add" />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto text-center">
          <h1 className="app-page-title">connect</h1>
          <p className="mt-3 text-sm text-text-2">This invite link is missing a token.</p>
          <Link
            to="/add"
            className="mt-6 rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
          >
            Go back
          </Link>
        </div>
      </main>
    )
  }

  if (!userId) {
    return (
      <main className={pageShellJourneyScroll}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 text-center">
          <span className="font-display text-4xl text-text">clingy</span>
          <p className="mt-1 text-sm text-text-3">stay close to the people that matter</p>

          <div className="my-8 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>

          <h2 className="text-lg font-medium text-text">You&apos;ve been invited to connect</h2>
          <p className="mt-2 max-w-xs text-sm text-text-2">
            Sign in to send your connection request. Takes about 30 seconds.
          </p>

          <button
            type="button"
            onClick={() => void handleSignIn()}
            className="btn-primary mt-6 w-full max-w-xs rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
          >
            Continue with Google
          </button>

          <p className="mt-4 max-w-xs text-xs text-text-3">
            This link expires in 60 s. If it expires, ask your friend for a fresh code.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className={pageShellJourneyScroll}>
      <BackHeader to="/home" />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto text-center">
        <h1 className="app-page-title">connect</h1>

        {submitting ? <p className="mt-6 text-sm text-text-2">Sending request...</p> : null}

        {connectIssue ? (
          <section className="mt-8 w-full rounded-lg border border-white/10 bg-surface p-6 text-left">
            <p className="text-sm text-playful">{connectIssue.message}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {connectIssue.type === 'already_connected' && connectIssue.connectedUser?.username ? (
                <Link
                  to={`/profile/${connectIssue.connectedUser.username}`}
                  className="btn-primary rounded-full bg-accent px-4 py-2 text-xs text-white"
                >
                  View profile
                </Link>
              ) : null}
              {(connectIssue.type === 'own' ||
                connectIssue.type === 'request_pending') ? (
                <button
                  type="button"
                  onClick={() => setConnectIssue(null)}
                  className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
                >
                  Dismiss
                </button>
              ) : null}
              {connectIssue.type === 'expired' ? (
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
                Go to pocket
              </Link>
            </div>
            {connectIssue.type === 'expired' ? (
              <p className="mt-3 text-xs text-text-3">
                Ask your friend to open{' '}
                <Link to="/add" className="underline underline-offset-2">Add someone</Link>
                {' '}and share a fresh code.
              </p>
            ) : null}
          </section>
        ) : null}

        {requestSent && !successUser && !connectIssue ? (
          <section className="mt-8 w-full rounded-lg border border-white/10 bg-surface p-6 text-center">
            <p className="text-sm text-active">Request sent.</p>
            <p className="mt-2 text-sm text-text-2">They&apos;ll get a notification to accept.</p>
            <Link
              to="/home"
              className="btn-primary mt-6 inline-block rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
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
              className="btn-primary mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white"
            >
              Send request
            </button>
          </section>
        ) : null}
      </div>

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
