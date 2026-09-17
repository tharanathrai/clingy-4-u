// Post-build guard: evaluate dist/sw.js in a stub ServiceWorker scope and
// fail if top-level code throws. A throwing SW script rejects registration
// silently in the browser (no service worker, no offline shell, no push,
// no update banner) — spec 022 shipped exactly that once via
// createHandlerBoundToURL('/') hitting `non-precached-url`.
import fs from 'node:fs'

const path = new URL('../dist/sw.js', import.meta.url)
if (!fs.existsSync(path)) {
  console.log('verify-sw: dist/sw.js absent (PWA_DISABLE?) — skipping')
  process.exit(0)
}

const src = fs.readFileSync(path, 'utf8')
const listeners = new Set()
const self = {
  addEventListener: (type) => listeners.add(type),
  location: { origin: 'https://example.test', href: 'https://example.test/sw.js' },
  registration: { scope: 'https://example.test/' },
  skipWaiting: async () => {},
  clients: {},
}
globalThis.self = self
globalThis.location = self.location
globalThis.registration = self.registration
globalThis.caches = { open: async () => ({}), keys: async () => [] }
globalThis.fetch = async () => new Response('')

try {
  new Function('self', src)(self)
} catch (error) {
  console.error('verify-sw: dist/sw.js threw during evaluation:', error)
  process.exit(1)
}

const required = ['push', 'notificationclick', 'message']
const missing = required.filter((type) => !listeners.has(type))
if (missing.length > 0) {
  console.error(`verify-sw: dist/sw.js is missing listeners: ${missing.join(', ')}`)
  process.exit(1)
}
console.log(`verify-sw: ok (${[...listeners].join(', ')})`)
