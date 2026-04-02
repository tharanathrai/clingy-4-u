import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase.ts'

interface GenerateQrTokenResponse {
  token: string
  expires_at: string
}

export default function Add() {
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(60)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchToken = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    const { data, error } = await supabase.functions.invoke<GenerateQrTokenResponse>(
      'generate-qr-token',
    )

    if (error || !data) {
      setErrorMessage('Something went wrong - try again.')
      setLoading(false)
      return
    }

    setToken(data.token)
    setExpiresAt(data.expires_at)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchToken()
  }, [fetchToken])

  useEffect(() => {
    if (!expiresAt) {
      return
    }

    const intervalId = window.setInterval(() => {
      const secondsLeft = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
      )
      setRemainingSeconds(secondsLeft)

      if (secondsLeft <= 0) {
        void fetchToken()
      }
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [expiresAt, fetchToken])

  const qrValue = useMemo(() => {
    if (!token) {
      return ''
    }
    return `${window.location.origin}/connect?token=${token}`
  }, [token])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-bg px-5 py-8 text-center text-text">
      <h1 className="font-display text-4xl">Add someone</h1>
      <p className="mt-3 max-w-xs text-sm text-text-2">
        Show this to someone you want to connect with. It refreshes every 60 seconds.
      </p>

      <div className="relative mt-8 flex h-72 w-72 items-center justify-center rounded-full bg-surface">
        <div className="qr-countdown-ring" />
        <div className="rounded-lg bg-white p-4">
          {loading ? (
            <div className="flex h-52 w-52 items-center justify-center text-sm text-black/60">
              Loading...
            </div>
          ) : token ? (
            <QRCodeSVG value={qrValue} size={208} />
          ) : (
            <div className="flex h-52 w-52 items-center justify-center text-sm text-black/60">
              Failed to generate code.
            </div>
          )}
        </div>
      </div>

      <p className="mt-5 text-sm text-text-2">{remainingSeconds}s</p>
      {errorMessage ? <p className="mt-2 text-sm text-playful">{errorMessage}</p> : null}

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          className="rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
          onClick={() => void fetchToken()}
        >
          Refresh now
        </button>
        <Link
          to="/add/scan"
          className="rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
        >
          Switch to scan
        </Link>
      </div>
    </main>
  )
}
