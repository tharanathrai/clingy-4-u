import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../hooks/useAuth.ts'

interface GenerateQrTokenResponse {
  token: string
  expires_at: string
}

interface CachedQrToken {
  token: string
  expires_at: string
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const QR_CACHE_KEY = 'qr_token_cache'
const MIN_REMAINING_SECONDS = 2

function getRemainingSeconds(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

function readCachedToken(): CachedQrToken | null {
  try {
    const raw = sessionStorage.getItem(QR_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedQrToken
    const secondsLeft = getRemainingSeconds(parsed.expires_at)
    return secondsLeft > MIN_REMAINING_SECONDS ? parsed : null
  } catch {
    return null
  }
}

function writeCachedToken(data: CachedQrToken) {
  try {
    sessionStorage.setItem(QR_CACHE_KEY, JSON.stringify(data))
  } catch {
    // sessionStorage unavailable — silently skip caching
  }
}

function clearCachedToken() {
  try {
    sessionStorage.removeItem(QR_CACHE_KEY)
  } catch {
    // ignore
  }
}

export default function Add() {
  const { signOut } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fetchInFlightRef = useRef(false)

  const fetchToken = useCallback(async (options?: { force?: boolean; showLoading?: boolean }) => {
    if (fetchInFlightRef.current) {
      return
    }

    const showLoading = options?.showLoading ?? false
    fetchInFlightRef.current = true
    if (showLoading) {
      setLoading(true)
    }
    setErrorMessage(null)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (sessionError || !accessToken) {
        setErrorMessage('No active session. Please sign in again.')
        setLoading(false)
        return
      }

      const { data: validatedUser, error: userError } = await supabase.auth.getUser(accessToken)
      if (userError || !validatedUser.user) {
        await signOut()
        setErrorMessage('Session expired. Please sign in again.')
        setLoading(false)
        return
      }

      const response = await fetch(`${functionsBaseUrl}/generate-qr-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ force: options?.force === true }),
      })

      if (!response.ok) {
        await response.text()
        setErrorMessage('Something went wrong - try again.')
        setLoading(false)
        return
      }

      const data = (await response.json()) as GenerateQrTokenResponse

      writeCachedToken(data)
      setToken(data.token)
      setExpiresAt(data.expires_at)
      setRemainingSeconds(getRemainingSeconds(data.expires_at))
      setLoading(false)
    } catch {
      setErrorMessage('Something went wrong - try again.')
      setLoading(false)
    } finally {
      fetchInFlightRef.current = false
    }
  }, [signOut])

  const loadToken = useCallback(() => {
    const cached = readCachedToken()
    if (cached) {
      setToken(cached.token)
      setExpiresAt(cached.expires_at)
      setRemainingSeconds(getRemainingSeconds(cached.expires_at))
      setLoading(false)
      return
    }
    void fetchToken({ showLoading: true })
  }, [fetchToken])

  useEffect(() => {
    loadToken()
  }, [loadToken])

  useEffect(() => {
    if (!expiresAt) {
      return
    }

    const syncRemainingSeconds = () => {
      const secondsLeft = getRemainingSeconds(expiresAt)
      setRemainingSeconds(secondsLeft)

      if (secondsLeft <= 0) {
        clearCachedToken()
        void fetchToken({ showLoading: false })
      }
    }

    syncRemainingSeconds()

    const intervalId = window.setInterval(() => {
      syncRemainingSeconds()
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
    <main className="safe-content-bottom mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-bg px-5 py-8 text-center text-text">
      <h1 className="app-page-title">Add someone</h1>
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
          className="rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
          onClick={() => {
            clearCachedToken()
            void fetchToken({ force: true, showLoading: false })
          }}
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
