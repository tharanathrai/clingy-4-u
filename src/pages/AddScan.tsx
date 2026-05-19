import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { supabase } from '../lib/supabase.ts'

interface ValidateQrResponse {
  success: boolean
  user: {
    display_name: string
    username: string
    avatar_url: string | null
  }
}

interface ValidateQrError {
  error?: string
  error_code?: string
  user?: ValidateQrResponse['user']
}

interface ScanIssue {
  message: string
  type: 'expired' | 'own' | 'already_connected' | 'network' | 'generic'
  connectedUser?: ValidateQrResponse['user']
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function AddScan() {
  const [scannedToken, setScannedToken] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successUser, setSuccessUser] = useState<ValidateQrResponse['user'] | null>(null)
  const [scanIssue, setScanIssue] = useState<ScanIssue | null>(null)

  useEffect(() => {
    if (scannedToken || successUser) {
      return
    }

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
      },
      false,
    )

    scanner.render(
      (decodedText) => {
        const token = extractToken(decodedText)
        if (!token) {
          setScanError('Unable to read token from this code.')
          return
        }

        setScanError(null)
        setScannedToken(token)
        void scanner.clear()
      },
      () => {
        // Continuous scanner callback intentionally ignored.
      },
    )

    return () => {
      void scanner.clear()
    }
  }, [scannedToken, successUser])

  const initials = useMemo(() => {
    if (!successUser) {
      return '?'
    }
    return successUser.display_name.slice(0, 1).toUpperCase()
  }, [successUser])

  const sendRequest = async () => {
    if (!scannedToken) {
      return
    }

    setSubmitting(true)
    setScanIssue(null)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token

    if (sessionError || !accessToken) {
      setScanIssue({
        message: 'No active session. Please sign in again.',
        type: 'generic',
      })
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch(`${functionsBaseUrl}/validate-qr-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token: scannedToken }),
      })

      const responseText = await response.text()
      let data: ValidateQrResponse | ValidateQrError | null = null
      if (responseText) {
        try {
          data = JSON.parse(responseText) as ValidateQrResponse | ValidateQrError
        } catch {
          data = null
        }
      }

      if (!response.ok || !data || !('success' in data) || !data.success) {
        const issue = getScanIssue(
          typeof data === 'object' && data && 'error' in data
            ? (data as ValidateQrError)
            : { error: responseText },
        )
        setScanIssue(issue)
        setSubmitting(false)
        return
      }

      setSuccessUser(data.user)
    } catch {
      setScanIssue({
        message: 'Something went wrong — try again.',
        type: 'network',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const resetScanner = () => {
    setScannedToken(null)
    setScanError(null)
    setScanIssue(null)
    setSuccessUser(null)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-bg px-5 py-8 text-text">
      <h1 className="text-center font-display text-4xl">Scan code</h1>

      {!successUser ? (
        <>
          <div className="qr-reader-container mt-6 rounded-lg border border-white/10 bg-surface p-4">
            <div id="qr-reader" />
          </div>

          {scanError ? <p className="mt-4 text-sm text-playful">{scanError}</p> : null}

          {scannedToken ? (
            <button
              type="button"
              className="mt-4 rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void sendRequest()}
              disabled={submitting}
            >
              {submitting ? 'Sending request...' : 'Send request'}
            </button>
          ) : null}

          {scanIssue ? (
            <div className="mt-4 rounded-lg border border-white/10 bg-surface-2 p-3 text-left">
              <p className="text-sm text-playful">{scanIssue.message}</p>
              <div className="mt-3 flex items-center gap-2">
                {(scanIssue.type === 'expired' || scanIssue.type === 'own' || scanIssue.type === 'generic') ? (
                  <button
                    type="button"
                    onClick={() => setScanIssue(null)}
                    className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
                  >
                    Dismiss
                  </button>
                ) : null}
                {scanIssue.type === 'network' ? (
                  <button
                    type="button"
                    onClick={() => void sendRequest()}
                    className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
                  >
                    Retry
                  </button>
                ) : null}
                {scanIssue.type === 'already_connected' && scanIssue.connectedUser?.username ? (
                  <Link
                    to={`/profile/${scanIssue.connectedUser.username}`}
                    className="rounded-full bg-accent px-4 py-2 text-xs text-white"
                  >
                    View profile
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <section className="mt-8 rounded-lg border border-white/10 bg-surface p-6 text-center">
          {successUser.avatar_url ? (
            <img
              src={successUser.avatar_url}
              alt={successUser.display_name}
              className="mx-auto h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-surface-2 text-2xl font-medium">
              {initials}
            </div>
          )}

          <p className="mt-4 text-lg text-text">{successUser.display_name}</p>
          <p className="text-sm text-text-2">@{successUser.username}</p>
          <p className="mt-3 text-sm text-active">Request sent.</p>
          <p className="mt-2 text-sm text-text-2">They&apos;ll get a notification to accept.</p>
        </section>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-8">
        {successUser ? (
          <button
            type="button"
            className="rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
            onClick={resetScanner}
          >
            Scan another
          </button>
        ) : null}
        <Link
          to="/add"
          className="rounded-full bg-surface-2 px-7 py-3.5 text-center text-sm font-medium text-text-2"
        >
          Back
        </Link>
      </div>
    </main>
  )
}

function extractToken(decodedValue: string): string | null {
  try {
    const url = new URL(decodedValue)
    return url.searchParams.get('token')
  } catch {
    const trimmedValue = decodedValue.trim()
    return trimmedValue.length > 0 ? trimmedValue : null
  }
}

function getScanIssue(errorPayload: ValidateQrError): ScanIssue {
  const normalizedMessage = (errorPayload.error ?? '').toLowerCase()
  const errorCode = errorPayload.error_code ?? ''

  if (errorCode === 'expired' || normalizedMessage.includes('expired')) {
    return {
      message: 'This code has expired. Ask them to refresh.',
      type: 'expired',
    }
  }

  if (
    errorCode === 'already_connected' ||
    normalizedMessage.includes('already connected')
  ) {
    const name = errorPayload.user?.display_name ?? 'this person'
    return {
      message: `You're already connected with ${name}.`,
      type: 'already_connected',
      connectedUser: errorPayload.user,
    }
  }

  if (
    errorCode === 'own_qr' ||
    normalizedMessage.includes('own qr') ||
    normalizedMessage.includes('your own')
  ) {
    return {
      message: "That's your own code.",
      type: 'own',
    }
  }

  return {
    message: 'Something went wrong — try again.',
    type: 'generic',
  }
}
