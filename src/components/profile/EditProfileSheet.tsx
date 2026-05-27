import { useEffect, useMemo, useState } from 'react'
import { ProfileAvatarField } from './ProfileAvatarField.tsx'
import { uploadAvatar } from '../../hooks/useAvatarUpload.ts'
import { supabase } from '../../lib/supabase.ts'
import type { User } from '../../types/index.ts'

interface EditProfileSheetProps {
  profile: User
  isOpen: boolean
  onClose: () => void
  onSaved: (profile: User) => void
}

export function EditProfileSheet({
  profile,
  isOpen,
  onClose,
  onSaved,
}: EditProfileSheetProps) {
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [avatarRemoved, setAvatarRemoved] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const normalizedUsername = useMemo(
    () => username.trim().toLowerCase().replace(/\s+/g, ''),
    [username],
  )

  const hasUsernameChanged = normalizedUsername !== profile.username
  const isDisplayNameValid =
    displayName.trim().length > 0 && displayName.trim().length <= 50
  const isUsernamePatternValid =
    normalizedUsername.length > 0 &&
    normalizedUsername.length <= 30 &&
    /^[a-z0-9_]+$/.test(normalizedUsername)
  const isBioValid = bio.trim().length <= 160

  const canSave =
    isDisplayNameValid &&
    isUsernamePatternValid &&
    isBioValid &&
    (!hasUsernameChanged || usernameAvailable === true) &&
    !saving

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setDisplayName(profile.display_name)
    setUsername(profile.username)
    setBio(profile.bio ?? '')
    setAvatarBlob(null)
    setAvatarRemoved(false)
    setErrorMessage(null)
    setUsernameAvailable(null)
    setCheckingUsername(false)
    setSaving(false)
  }, [isOpen, profile])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (!hasUsernameChanged) {
      setUsernameAvailable(true)
      setCheckingUsername(false)
      return
    }

    if (!isUsernamePatternValid) {
      setUsernameAvailable(null)
      setCheckingUsername(false)
      return
    }

    setCheckingUsername(true)
    setUsernameAvailable(null)

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', normalizedUsername)
          .neq('id', profile.id)
          .maybeSingle()

        if (error) {
          setUsernameAvailable(null)
          setCheckingUsername(false)
          return
        }

        setUsernameAvailable(!data)
        setCheckingUsername(false)
      })()
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hasUsernameChanged, isOpen, isUsernamePatternValid, normalizedUsername, profile.id])

  const handleAvatarReady = (blob: Blob | null) => {
    if (blob) {
      setAvatarBlob(blob)
      setAvatarRemoved(false)
      return
    }

    setAvatarBlob(null)
    setAvatarRemoved(true)
  }

  const handleSave = async () => {
    if (!canSave) {
      return
    }

    setSaving(true)
    setErrorMessage(null)

    try {
      let avatarUrl = profile.avatar_url

      if (avatarRemoved) {
        avatarUrl = null
      } else if (avatarBlob) {
        avatarUrl = await uploadAvatar(profile.id, avatarBlob, { upsert: true })
      }

      const updates = {
        display_name: displayName.trim(),
        username: normalizedUsername,
        bio: bio.trim() ? bio.trim() : null,
        avatar_url: avatarUrl,
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.id)
        .select('*')
        .single()

      if (updateError || !updatedProfile) {
        throw updateError ?? new Error('Profile update failed.')
      }

      onSaved(updatedProfile as User)
    } catch {
      setErrorMessage('Something went wrong — try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) {
    return null
  }

  const avatarImageUrl = avatarRemoved ? null : profile.avatar_url

  return (
    <section className="app-fixed-viewport z-50">
      <button
        type="button"
        aria-label="Close edit profile"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute inset-x-0 bottom-0 app-fixed-frame-inner rounded-t-xl border-t border-white/10 bg-surface px-5 pb-8 pt-4">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 className="font-display text-2xl text-text">Edit profile</h2>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs uppercase text-text-3">Display name</span>
            <input
              value={displayName}
              maxLength={50}
              onChange={(event) => {
                setDisplayName(event.target.value)
              }}
              className="mt-2 w-full rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-white/20"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase text-text-3">Username</span>
            <input
              value={username}
              maxLength={30}
              onChange={(event) => {
                setUsername(event.target.value.toLowerCase())
              }}
              className="mt-2 w-full rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-white/20"
            />
            <p className="mt-1 text-xs text-text-3">{normalizedUsername.length}/30</p>
            {!isUsernamePatternValid ? (
              <p className="mt-1 text-xs text-playful">
                Use lowercase letters, numbers, or underscores.
              </p>
            ) : null}
            {checkingUsername ? (
              <p className="mt-1 text-xs text-text-2">Checking username...</p>
            ) : null}
            {hasUsernameChanged && usernameAvailable === true ? (
              <p className="mt-1 text-xs text-active">Username is available.</p>
            ) : null}
            {hasUsernameChanged && usernameAvailable === false ? (
              <p className="mt-1 text-xs text-playful">That username is taken.</p>
            ) : null}
          </label>

          <div>
            <span className="text-xs uppercase text-text-3">Avatar</span>
            <div className="mt-3">
              <ProfileAvatarField
                displayName={profile.display_name}
                imageUrl={avatarImageUrl}
                fallbackInitial={profile.display_name.charAt(0).toUpperCase()}
                size="md"
                allowRemove
                onImageReady={handleAvatarReady}
              />
            </div>
          </div>

          <label className="block">
            <span className="text-xs uppercase text-text-3">Bio</span>
            <textarea
              value={bio}
              maxLength={160}
              onChange={(event) => {
                setBio(event.target.value)
              }}
              rows={4}
              className="mt-2 w-full resize-none rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-white/20"
            />
            <p className="mt-1 text-right text-xs text-text-3">{bio.length}/160</p>
          </label>

          {errorMessage ? <p className="text-sm text-playful">{errorMessage}</p> : null}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-full bg-surface-2 px-5 py-3 text-sm text-text-2"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              void handleSave()
            }}
            disabled={!canSave}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )
}
