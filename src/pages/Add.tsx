import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Camera, RefreshCcw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { Spinner } from '../components/Spinner.tsx'
import { pageShellPinnedFooter } from '../components/layout/pageShell.ts'
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
const QR_TTL_MS = 60_000
const HEAD_LOCK_MS = 1_000

function getRemainingSeconds(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

function getRemainingMs(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now())
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
  const navigate = useNavigate()
  const location = useLocation()
  const fromOnboarding = (location.state as { fromOnboarding?: boolean } | null)?.fromOnboarding === true
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
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
      setRemainingMs(getRemainingMs(data.expires_at))
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
      setRemainingMs(getRemainingMs(cached.expires_at))
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

    let animationFrameId = 0

    const syncRemainingSeconds = () => {
      const msLeft = getRemainingMs(expiresAt)
      setRemainingMs(msLeft)

      if (msLeft <= 0) {
        clearCachedToken()
        void fetchToken({ showLoading: false })
        return
      }

      animationFrameId = window.requestAnimationFrame(syncRemainingSeconds)
    }

    syncRemainingSeconds()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [expiresAt, fetchToken])

  const qrValue = useMemo(() => {
    if (!token) {
      return ''
    }
    return `${window.location.origin}/connect?token=${token}`
  }, [token])

  const remainingFraction = useMemo(() => {
    if (!expiresAt) return 1
    const effectiveRemainingMs = Math.max(0, remainingMs - HEAD_LOCK_MS)
    const effectiveDurationMs = QR_TTL_MS - HEAD_LOCK_MS
    return Math.min(1, Math.max(0, effectiveRemainingMs / effectiveDurationMs))
  }, [expiresAt, remainingMs])

  const remainingSeconds = Math.ceil(remainingMs / 1000)

  const ringDeg = remainingFraction * 360

  return (
    <main className={`${pageShellPinnedFooter} pb-tab-clearance`}>
      <BackHeader
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1)
            return
          }
          navigate('/home')
        }}
      />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="app-page-title">add someone</h1>
        {fromOnboarding ? (
          <p className="mt-2 text-sm text-text-2">
            You&apos;re all set! Show this to a friend to connect.
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-2">
            Show this to someone nearby.
          </p>
        )}

        {/* QR card — gradient border is the countdown ring */}
        <div
          className="mt-8 shrink-0"
          style={{
            padding: '3px',
            borderRadius: '20px',
            background: `conic-gradient(from -90deg, #cf8ee8 ${ringDeg}deg, rgba(207,142,232,0.12) ${ringDeg}deg 360deg)`,
          }}
        >
          <div className="bg-white p-5" style={{ borderRadius: '17px' }}>
            {loading ? (
              <div className="flex h-[220px] w-[220px] items-center justify-center">
                <Spinner size={28} />
              </div>
            ) : token ? (
              <QRCodeSVG value={qrValue} size={220} />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-black/40">
                Couldn&apos;t load code
              </div>
            )}
          </div>
        </div>

        {/* Countdown + inline refresh */}
        <div className="mt-5 flex items-center gap-2">
          <span className="font-display text-3xl text-text">{remainingSeconds}</span>
          <span className="text-sm text-text-3">s</span>
          <button
            type="button"
            onClick={() => {
              clearCachedToken()
              void fetchToken({ force: true, showLoading: false })
            }}
            className="ml-2 flex min-h-11 items-center gap-1.5 text-sm text-text-3 transition-colors active:text-text-2"
          >
            <RefreshCcw size={14} strokeWidth={1.75} />
            Refresh
          </button>
        </div>

        {errorMessage ? (
          <p className="mt-3 text-sm text-playful">{errorMessage}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <Link
          to="/add/scan"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
        >
          <Camera size={16} strokeWidth={1.75} />
          Scan their code instead
        </Link>
      </div>
    </main>
  )
}
