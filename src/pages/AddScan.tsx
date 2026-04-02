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

export default function AddScan() {
  const [scannedToken, setScannedToken] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successUser, setSuccessUser] = useState<ValidateQrResponse['user'] | null>(null)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

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
    setSubmitMessage(null)

    const { data, error } = await supabase.functions.invoke<ValidateQrResponse>(
      'validate-qr-token',
      {
        body: { token: scannedToken },
      },
    )

    if (error || !data?.success) {
      const message = getScanErrorMessage(error?.message)
      setSubmitMessage(message)
      setSubmitting(false)
      return
    }

    setSuccessUser(data.user)
    setSubmitting(false)
  }

  const resetScanner = () => {
    setScannedToken(null)
    setScanError(null)
    setSubmitMessage(null)
    setSuccessUser(null)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-bg px-5 py-8 text-text">
      <h1 className="text-center font-display text-4xl">Scan code</h1>

      {!successUser ? (
        <>
          <div className="mt-6 rounded-lg border border-white/10 bg-surface p-4">
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

          {submitMessage ? <p className="mt-3 text-sm text-playful">{submitMessage}</p> : null}
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

function getScanErrorMessage(errorMessage?: string): string {
  const normalizedMessage = (errorMessage ?? '').toLowerCase()

  if (normalizedMessage.includes('expired')) {
    return 'This code has expired. Ask them to refresh.'
  }
  if (normalizedMessage.includes('already connected')) {
    return "You're already connected with this person."
  }
  if (normalizedMessage.includes('own qr') || normalizedMessage.includes('your own')) {
    return "That's your own code."
  }

  return 'Something went wrong - try again.'
}
