import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { EditProfileSheet } from '../components/profile/EditProfileSheet.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useProfile } from '../hooks/useProfile.ts'

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const { profile, loading: profileLoading, refetch } = useProfile({ userId: user?.id })
  const [isEditing, setIsEditing] = useState(false)
  const [inviteEmailNotif, setInviteEmailNotif] = useState(true)
  const [expiryEmailNotif, setExpiryEmailNotif] = useState(true)

  useEffect(() => {
    const inviteValue = window.localStorage.getItem('notif_email_invite')
    const expiryValue = window.localStorage.getItem('notif_email_expiry')
    setInviteEmailNotif(inviteValue !== 'false')
    setExpiryEmailNotif(expiryValue !== 'false')
  }, [])

  const canEditProfile = Boolean(profile)
  const signedInEmail = useMemo(() => user?.email ?? 'No email found', [user?.email])

  if (authLoading || profileLoading) {
    return (
      <main className="safe-screen-height mx-auto w-full max-w-md bg-bg px-5 py-8 text-text">
        <div className="skeleton mb-6 h-7 w-24 rounded" />
        <section className="rounded-lg bg-surface p-4">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="skeleton h-14 w-14 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-3 w-48 rounded" />
            </div>
          </div>
          <div className="skeleton mt-4 h-4 w-28 rounded" />
        </section>
        <section className="mt-6 rounded-lg bg-surface p-4 space-y-3">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-10 w-full rounded" />
          <div className="skeleton h-10 w-full rounded" />
        </section>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  const handleInviteToggle = () => {
    const nextValue = !inviteEmailNotif
    setInviteEmailNotif(nextValue)
    window.localStorage.setItem('notif_email_invite', String(nextValue))
  }

  const handleExpiryToggle = () => {
    const nextValue = !expiryEmailNotif
    setExpiryEmailNotif(nextValue)
    window.localStorage.setItem('notif_email_expiry', String(nextValue))
  }

  return (
    <main className="safe-screen-height safe-content-bottom safe-content-top mx-auto w-full max-w-md overflow-y-auto bg-bg px-5 pb-8 pt-6 text-text">
      <Link to="/profile/me" className="inline-flex min-h-11 items-center gap-2 text-sm text-text-2">
        <ArrowLeft size={18} strokeWidth={1.75} />
        back
      </Link>
      <h1 className="app-page-title mt-4">settings</h1>

      <section className="mt-6 rounded-lg bg-surface p-5">
        <h2 className="text-xs uppercase text-text-3">Account</h2>
        <div className="mt-4 flex items-center gap-3">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-sm text-text-2">
              {(profile?.display_name?.slice(0, 1) ?? 'U').toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm text-text">Signed in as {profile?.display_name ?? 'You'}</p>
            <p className="text-xs text-text-2">{signedInEmail}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={!canEditProfile}
            onClick={() => setIsEditing(true)}
            className="flex-1 rounded-full bg-surface-2 px-4 py-2.5 text-sm text-text-2 disabled:opacity-50"
          >
            Edit profile
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex-1 rounded-full border border-playful/40 bg-transparent px-4 py-2.5 text-sm text-playful"
          >
            Sign out
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-lg bg-surface p-5">
        <h2 className="text-xs uppercase text-text-3">Notifications</h2>
        <div className="mt-4 space-y-3">
          <NotificationToggleRow
            label="Email me when someone invites me"
            enabled={inviteEmailNotif}
            onToggle={handleInviteToggle}
          />
          <NotificationToggleRow
            label="Email me when a plan expires"
            enabled={expiryEmailNotif}
            onToggle={handleExpiryToggle}
          />
        </div>
      </section>

      <section className="mt-4 rounded-lg bg-surface p-5">
        <h2 className="text-xs uppercase text-text-3">About</h2>
        <p className="mt-3 text-sm text-text">Version 0.1.0</p>
        <p className="mt-1 text-sm text-text-3">Built with ☁️ and gum.</p>
      </section>

      {profile ? (
        <EditProfileSheet
          profile={profile}
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false)
            refetch()
          }}
        />
      ) : null}
    </main>
  )
}

interface NotificationToggleRowProps {
  label: string
  enabled: boolean
  onToggle: () => void
}

function NotificationToggleRow({
  label,
  enabled,
  onToggle,
}: NotificationToggleRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex min-h-11 w-full items-center justify-between rounded-lg bg-surface-2 px-4 py-3 text-left"
    >
      <span className="text-sm text-text">{label}</span>
      <span
        className={`h-6 w-11 rounded-full p-0.5 transition ${enabled ? 'bg-accent' : 'bg-bg'}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
