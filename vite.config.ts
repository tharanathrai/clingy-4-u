import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Disabled in e2e (Playwright runs `vite preview`, a prod build where the
      // SW would otherwise register): a stale precache under reuseExistingServer
      // can serve old assets across runs and cause flaky local failures.
      disable: process.env.PWA_DISABLE === 'true',
      // Prompt the user to reload rather than swapping the SW mid-session
      // (safer for in-progress posts / QR flows). See onNeedRefresh in main.tsx.
      registerType: 'prompt',
      // Reuse the existing public/manifest.json — single source of truth.
      manifest: false,
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icons.svg'],
      workbox: {
        // SPA: unmatched navigations fall back to the app shell, matching
        // the vercel.json rewrite (/(.*) -> /).
        navigateFallback: '/',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    globals: true,
    // happy-dom avoids the jsdom/csstools ESM incompatibility in this stack
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
  },
})
