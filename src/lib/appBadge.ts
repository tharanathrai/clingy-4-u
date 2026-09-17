// App icon badge (Badging API). Android Chrome shows a dot on the installed
// PWA, iOS 16.4+ shows the number. No-op where unsupported or not installed.

export async function syncAppBadge(unreadCount: number): Promise<void> {
  if (typeof navigator === 'undefined') return
  try {
    if (unreadCount > 0 && 'setAppBadge' in navigator) {
      await navigator.setAppBadge(unreadCount)
    } else if ('clearAppBadge' in navigator) {
      await navigator.clearAppBadge()
    }
  } catch {
    // Not installed / permission not granted — badge is best-effort.
  }
}
