import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ProfileAvatarField } from '../components/profile/ProfileAvatarField.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { uploadAvatar } from '../hooks/useAvatarUpload.ts'
import { markProfileReady } from '../hooks/useProfileReady.ts'
import { pageShellScroll } from '../components/layout/pageShell.ts'
import { FullScreenSpinner } from '../components/Spinner.tsx'
import { postAuthReturnToKey } from '../lib/recoveryPath.ts'
import { track } from '../lib/analytics.ts'
import { supabase } from '../lib/supabase.ts'

export default function Welcome() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, loading } = useAuth()
  // Captured once on mount; survives the /welcome redirect because it lives in sessionStorage,
  // not router state. Cleared when onboarding completes.
  const [returnTo] = useState<string | null>(() =>
    sessionStorage.getItem(postAuthReturnToKey),
  )

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const normalizedUsername = username.trim().toLowerCase()
  const sanitizedUsername = normalizedUsername.replace(/\s+/g, '')

  const isDisplayNameValid = displayName.trim().length > 0 && displayName.length <= 50
  const isUsernamePatternValid =
    sanitizedUsername.length > 0 &&
    sanitizedUsername.length <= 30 &&
    /^[a-z0-9_]+$/.test(sanitizedUsername)
  const canComplete = isDisplayNameValid && isUsernamePatternValid && usernameAvailable

  const initial = useMemo(() => {
    const source = displayName.trim()
    return source.length > 0 ? source[0].toUpperCase() : '?'
  }, [displayName])

  useEffect(() => {
    if (!isUsernamePatternValid) {
      setUsernameAvailable(null)
      setUsernameChecking(false)
      return
    }

    setUsernameChecking(true)
    setUsernameAvailable(null)

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', sanitizedUsername)
          .maybeSingle()

        if (error) {
          setUsernameAvailable(null)
          setUsernameChecking(false)
          return
        }

        setUsernameAvailable(!data)
        setUsernameChecking(false)
      })()
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isUsernamePatternValid, sanitizedUsername])

  const handleComplete = async () => {
    if (!user || !canComplete) {
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      let avatarUrl: string | null = null

      if (avatarBlob) {
        avatarUrl = await uploadAvatar(user.id, avatarBlob, { upsert: false })
      }

      const { error: insertError } = await supabase.from('users').insert({
        id: user.id,
        display_name: displayName.trim(),
        username: sanitizedUsername,
        avatar_url: avatarUrl,
      })

      if (insertError) {
        throw insertError
      }

      track('onboarding_step', { step: 'profile_complete' }, 'welcome')
      markProfileReady(user.id, queryClient)
      // Don't clear the connect key here — AuthGuard reads it on the same render to pick the
      // same target (this navigate and AuthGuard's redirect can race). Connect clears it on send.
      navigate(
        returnTo && /^\/connect(\?|$)/.test(returnTo) ? returnTo : '/add',
        { replace: true, state: returnTo ? undefined : { fromOnboarding: true } },
      )
    } catch {
      setErrorMessage('Something went wrong - try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <FullScreenSpinner />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const showConnectHint = Boolean(returnTo && /^\/connect(\?|$)/.test(returnTo))

  return (
    <main className={`${pageShellScroll} safe-content-bottom pt-6`}>
      <h1 className="font-display text-4xl">Set up your profile</h1>
      <p className="mt-2 text-sm text-text-2">
        {showConnectHint
          ? 'One step away from connecting — just your name and a username.'
          : 'Just your name and a username to get started.'}
      </p>

      <div className="mt-6 flex flex-col items-center">
        <ProfileAvatarField
          displayName={displayName.trim() || 'You'}
          imageUrl={null}
          fallbackInitial={initial}
          size="md"
          onImageReady={(blob) => {
            setAvatarBlob(blob)
            setErrorMessage(null)
          }}
        />
        <p className="mt-2 text-xs text-text-3">Tap to add a photo (optional)</p>
      </div>

      <label className="mt-7 text-sm text-text-2" htmlFor="display-name">
        Display name
      </label>
      <input
        id="display-name"
        value={displayName}
        maxLength={50}
        onChange={(event) => setDisplayName(event.target.value)}
        className="mt-2 w-full rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-text outline-none focus:border-white/20"
        placeholder="Your name"
      />
      <p className="mt-1.5 text-xs text-text-3">{displayName.length}/50</p>

      <label className="mt-5 text-sm text-text-2" htmlFor="username">
        Username
      </label>
      <input
        id="username"
        value={username}
        maxLength={30}
        onChange={(event) => setUsername(event.target.value.toLowerCase())}
        className="mt-2 w-full rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-text outline-none focus:border-white/20"
        placeholder="username"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-xs text-text-3">
          Lowercase letters, numbers, and underscores only.
        </p>
        <p className="shrink-0 text-xs text-text-3">{sanitizedUsername.length}/30</p>
      </div>
      {!isUsernamePatternValid && sanitizedUsername.length > 0 ? (
        <p className="mt-1.5 text-sm text-playful">Use lowercase letters, numbers, or _.</p>
      ) : null}
      {usernameChecking ? (
        <p className="mt-1.5 text-sm text-text-2">Checking availability...</p>
      ) : null}
      {usernameAvailable === true ? (
        <p className="mt-1.5 text-sm text-active">Username is available.</p>
      ) : null}
      {usernameAvailable === false ? (
        <p className="mt-1.5 text-sm text-playful">That username is taken.</p>
      ) : null}

      {errorMessage ? <p className="mt-4 text-sm text-playful">{errorMessage}</p> : null}

      <button
        type="button"
        className="btn-primary mt-8 w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => void handleComplete()}
        disabled={submitting || !canComplete}
      >
        {submitting ? 'Saving...' : 'Finish'}
      </button>
    </main>
  )
}
