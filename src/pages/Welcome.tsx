import { useEffect, useMemo, useState } from 'react'
import { Camera } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth.ts'
import { markProfileReady } from '../hooks/useProfileReady.ts'
import { supabase } from '../lib/supabase.ts'

export default function Welcome() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, loading } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
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

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setAvatarFile(file)
    setErrorMessage(null)

    if (!file) {
      setAvatarPreviewUrl(null)
      return
    }

    const localUrl = URL.createObjectURL(file)
    setAvatarPreviewUrl(localUrl)
  }

  const handleComplete = async () => {
    if (!user || !canComplete) {
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      let avatarUrl: string | null = null

      if (avatarFile) {
        const extension = avatarFile.name.split('.').pop()?.toLowerCase() ?? 'png'
        const filePath = `${user.id}/${Date.now()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, {
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(filePath)

        avatarUrl = publicUrl
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

      // Immediately update the React Query cache so AuthGuard redirects
      // without waiting for a network re-check
      markProfileReady(user.id, queryClient)
      navigate('/add', { replace: true })
    } catch {
      setErrorMessage('Something went wrong - try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Loading...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-bg px-5 py-8 text-text">
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((dot) => (
          <span
            key={dot}
            className={`h-2.5 w-2.5 rounded-full ${
              step === dot ? 'bg-accent' : 'bg-text-3'
            }`}
          />
        ))}
      </div>
      <p className="-mt-5 mb-6 text-center text-xs text-text-3">Step {step} of 3</p>

      {step === 1 ? (
        <section className="flex flex-1 flex-col">
          <h1 className="font-display text-4xl">Add your name</h1>
          <p className="mt-2 text-sm text-text-2">This is how people will see you.</p>
          <label className="mt-8 text-sm text-text-2" htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            value={displayName}
            maxLength={50}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-text outline-none focus:border-white/20"
            placeholder="Your name"
          />
          <p className="mt-2 text-xs text-text-3">{displayName.length}/50</p>

          <button
            type="button"
            className="mt-auto rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isDisplayNameValid}
            onClick={() => setStep(2)}
          >
            Continue
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-1 flex-col">
          <h1 className="font-display text-4xl">Pick a username</h1>
          <p className="mt-2 text-sm text-text-2">
            Lowercase letters, numbers, and underscores only.
          </p>
          <label className="mt-8 text-sm text-text-2" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            value={username}
            maxLength={30}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            className="mt-2 rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-text outline-none focus:border-white/20"
            placeholder="username"
          />
          <p className="mt-2 text-xs text-text-3">{sanitizedUsername.length}/30</p>
          {!isUsernamePatternValid && sanitizedUsername.length > 0 ? (
            <p className="mt-2 text-sm text-playful">Use lowercase letters, numbers, or _.</p>
          ) : null}
          {usernameChecking ? (
            <p className="mt-2 text-sm text-text-2">Checking availability...</p>
          ) : null}
          {usernameAvailable === true ? (
            <p className="mt-2 text-sm text-active">Username is available.</p>
          ) : null}
          {usernameAvailable === false ? (
            <p className="mt-2 text-sm text-playful">That username is taken.</p>
          ) : null}

          <div className="mt-auto flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="flex-1 rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isUsernamePatternValid || usernameAvailable !== true}
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="flex flex-1 flex-col">
          <h1 className="font-display text-4xl">Choose your avatar</h1>
          <p className="mt-2 text-sm text-text-2">
            Start with an initial avatar or upload your own.
          </p>

          <div className="mt-8 flex items-center justify-center">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="Avatar preview"
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-2 text-3xl font-medium text-text">
                {initial}
              </div>
            )}
          </div>

          <label className="mt-6 cursor-pointer text-center" htmlFor="avatar-upload">
            <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2">
              <Camera size={16} strokeWidth={1.75} />
              Tap to upload
            </span>
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="sr-only"
          />

          {errorMessage ? <p className="mt-3 text-sm text-playful">{errorMessage}</p> : null}

          <div className="mt-auto flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
              onClick={() => setStep(2)}
              disabled={submitting}
            >
              Back
            </button>
            <button
              type="button"
              className="flex-1 rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleComplete()}
              disabled={submitting || !canComplete}
            >
              {submitting ? 'Saving...' : 'Finish'}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  )
}
