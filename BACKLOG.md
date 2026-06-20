# UX Follow-Ups (from live testing)

> Product truth lives in `PRD.md`, `DESIGN.md`, and `DEVDOC.md` (last synced 2026-06-11).

## Network Graph Viewport + Export

1. Share image quality is poor for social posting. ✅ Addressed (spec `016-social-share-export`)
   - Bridge Constellation Card: 4:5 (1080×1350), stats footer, category glow, grain, export-only zoom/label boost.
   - Stretch deferred: square/stories presets, spotlight card when a node is selected.

2. Desktop graph framing can start far from the visible viewport. ✅ Addressed
   - Implemented container-based canvas sizing (instead of viewport-only sizing).
   - Added deterministic camera recenter + zoom-to-fit on graph load.
   - Added zoom limits to avoid extreme initial framing.

3. Mobile graph framing feels over-zoomed/cropped. ✅ Addressed
   - Implemented mobile-aware zoom-to-fit padding on initial graph framing.
   - Added orientation/resize camera sizing updates for mobile viewport changes.

## App Lifecycle / Refresh UX

4. App appears to refresh/reload when switching tabs/windows or navigating between pages. ✅ Addressed
   - Reworked auth state handling into a shared store in `useAuth` so pages/hooks do not repeatedly re-enter loading on remount.
   - Added stale-while-revalidate caches in `useNotifications`, `useGumPieces`, `useNetworkGraph`, and home connection count fetch to avoid loading flashes on tab/page switches.
   - Goal is preserved route/UI state without disruptive "session checking" flashes when switching tabs/windows.

## Mobile / Install

5. PWA install shipped (service worker via `vite-plugin-pwa`, installable on Android + iOS, offline shell, reload prompt). Deferred follow-ups:
   - Push notifications + icon badges layer onto the same SW (VAPID + Supabase Edge Function sender; iOS push needs installed PWA on 16.4+). Seam documented in `src/lib/registerPwa.ts`.
   - Native Capacitor wrappers (`android/`, `ios/`) are **stale/unshippable**: `@capacitor/cli ^7.6.5` mismatches `@capacitor/core|android|ios ^8.3.4`, no native plugins used, nothing published to stores. Align versions before any native store path.
