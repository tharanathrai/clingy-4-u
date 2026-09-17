/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// Custom service worker (vite-plugin-pwa `injectManifest`). Precaching and the
// SPA navigation fallback reproduce what the previous generateSW build did;
// the push handlers are the reason this file exists (spec 022).

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA: unmatched navigations fall back to the app shell, matching the
// vercel.json rewrite (/(.*) -> /). Must be the precache key ('/index.html'),
// not '/': createHandlerBoundToURL does an exact lookup and throws
// `non-precached-url` otherwise, which fails SW evaluation and leaves the
// app with no service worker at all.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// registerType: 'prompt' — the reload banner posts SKIP_WAITING on accept.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

const FALLBACK_PAYLOAD: PushPayload = {
  title: 'Clingy',
  body: 'You have a new notification',
  url: '/notifications',
}

function parsePushPayload(data: PushMessageData | null): PushPayload {
  if (!data) return FALLBACK_PAYLOAD
  try {
    const parsed: unknown = data.json()
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as PushPayload).title === 'string' &&
      typeof (parsed as PushPayload).body === 'string'
    ) {
      const payload = parsed as PushPayload
      return {
        title: payload.title,
        body: payload.body,
        url: typeof payload.url === 'string' ? payload.url : FALLBACK_PAYLOAD.url,
        tag: typeof payload.tag === 'string' ? payload.tag : undefined,
      }
    }
  } catch {
    // not JSON — fall through to plain text
  }
  const text = data.text()
  return text ? { ...FALLBACK_PAYLOAD, body: text } : FALLBACK_PAYLOAD
}

// Always show something: iOS revokes the subscription after silent pushes.
self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event.data)
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url },
    }),
  )
})

// Focus an open Clingy window if there is one, otherwise open a new one.
// /notifications already routes each type to the right screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | undefined
  const target = new URL(data?.url ?? '/notifications', self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (windows) => {
        const existing = windows.find((client) =>
          client.url.startsWith(self.location.origin),
        )
        if (existing) {
          await existing.focus()
          if ('navigate' in existing) {
            await existing.navigate(target)
          }
          return
        }
        await self.clients.openWindow(target)
      }),
  )
})
