import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { EditProfileSheet } from '../components/profile/EditProfileSheet.tsx'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { pageShellScroll } from '../components/layout/pageShell.ts'
import { FullScreenSpinner } from '../components/Spinner.tsx'
import { sectionHeadingClass } from '../lib/typography.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { useProfile } from '../hooks/useProfile.ts'
import { invalidateProfileFlow } from '../lib/invalidate.ts'
import { getAnalyticsConsent, setAnalyticsConsent } from '../lib/analytics.ts'
import {
  detectPushSupport,
  getPushStatus,
  PushPermissionDeniedError,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from '../lib/push.ts'
import type { PushSupport } from '../lib/pushSupport.ts'

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { profile, loading: profileLoading } = useProfile({ userId: user?.id })
  const [isEditing, setIsEditing] = useState(false)
  const [inviteEmailNotif, setInviteEmailNotif] = useState(true)
  const [expiryEmailNotif, setExpiryEmailNotif] = useState(true)
  const [analyticsConsent, setAnalyticsConsentState] = useState(true)
  const [pushSupport, setPushSupport] = useState<PushSupport>('unsupported')
  const [pushStatus, setPushStatus] = useState<PushStatus>('off')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  useEffect(() => {
    const inviteValue = window.localStorage.getItem('notif_email_invite')
    const expiryValue = window.localStorage.getItem('notif_email_expiry')
    setInviteEmailNotif(inviteValue !== 'false')
    setExpiryEmailNotif(expiryValue !== 'false')
    setAnalyticsConsentState(getAnalyticsConsent())
  }, [])

  useEffect(() => {
    let cancelled = false
    const support = detectPushSupport()
    setPushSupport(support)
    if (support !== 'supported') return
    void getPushStatus().then((status) => {
      if (!cancelled) setPushStatus(status)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const canEditProfile = Boolean(profile)
  const signedInEmail = useMemo(() => user?.email ?? 'No email found', [user?.email])

  if (authLoading || profileLoading) {
    return <FullScreenSpinner />
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

  const handleAnalyticsToggle = () => {
    const nextValue = !analyticsConsent
    setAnalyticsConsentState(nextValue)
    setAnalyticsConsent(nextValue)
  }

  // Runs inside the click handler so the permission prompt counts as a
  // user gesture (iOS requirement).
  const handlePushToggle = async () => {
    if (pushBusy || !user) return
    setPushBusy(true)
    setPushError(null)
    try {
      if (pushStatus === 'on') {
        await unsubscribeFromPush()
        setPushStatus('off')
      } else {
        await subscribeToPush(user.id)
        setPushStatus('on')
      }
    } catch (error) {
      if (error instanceof PushPermissionDeniedError) {
        setPushStatus(Notification.permission === 'denied' ? 'denied' : 'off')
      } else {
        setPushError(
          error instanceof Error ? error.message : 'Could not update push notifications.',
        )
      }
    } finally {
      setPushBusy(false)
    }
  }

  const pushHint = getPushHint(pushSupport, pushStatus)

  return (
    <main className={`${pageShellScroll} safe-content-bottom pb-8 pt-6`}>
      <BackHeader to="/profile/me" />
      <h1 className="app-page-title mt-4">settings</h1>

      <section className="mt-6 rounded-lg bg-surface p-5">
        <h2 className={sectionHeadingClass}>Account</h2>
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
        <h2 className={sectionHeadingClass}>Notifications</h2>
        <div className="mt-4 space-y-3">
          {pushSupport !== 'unsupported' ? (
            <NotificationToggleRow
              label="Push notifications"
              enabled={pushStatus === 'on'}
              disabled={pushBusy || pushSupport !== 'supported' || pushStatus === 'denied'}
              onToggle={() => void handlePushToggle()}
            />
          ) : null}
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
        {pushHint ? <p className="mt-3 text-xs text-text-3">{pushHint}</p> : null}
        {pushError ? (
          <p className="mt-2 text-xs text-playful" role="alert">
            {pushError}
          </p>
        ) : null}
      </section>

      <section className="mt-4 rounded-lg bg-surface p-5">
        <h2 className={sectionHeadingClass}>Privacy</h2>
        <div className="mt-4 space-y-3">
          <NotificationToggleRow
            label="Share anonymous usage data"
            enabled={analyticsConsent}
            onToggle={handleAnalyticsToggle}
          />
        </div>
        <p className="mt-3 text-xs text-text-3">
          Helps us improve Clingy. No names, messages, or plan details are ever
          collected — only anonymous, aggregated taps and screens.
        </p>
      </section>

      <section className="mt-4 rounded-lg bg-surface p-5">
        <h2 className={sectionHeadingClass}>About</h2>
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
            if (user?.id) {
              invalidateProfileFlow(user.id, queryClient)
            }
          }}
        />
      ) : null}
    </main>
  )
}

function getPushHint(support: PushSupport, status: PushStatus): string | null {
  if (support === 'needs-install') {
    return 'On iPhone, add Clingy to your Home Screen first (Share → Add to Home Screen), then turn on push here.'
  }
  if (support === 'supported' && status === 'denied') {
    return 'Notifications are blocked for Clingy in your browser settings.'
  }
  if (support === 'supported') {
    return 'Get told when someone invites you, connects, or a plan needs you — even when Clingy is closed.'
  }
  return null
}

interface NotificationToggleRowProps {
  label: string
  enabled: boolean
  disabled?: boolean
  onToggle: () => void
}

function NotificationToggleRow({
  label,
  enabled,
  disabled = false,
  onToggle,
}: NotificationToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="flex min-h-11 w-full items-center justify-between rounded-lg bg-surface-2 px-4 py-3 text-left disabled:opacity-60"
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
