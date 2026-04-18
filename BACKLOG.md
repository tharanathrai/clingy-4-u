# UX Follow-Ups (from live testing)

## Network Graph Viewport + Export

1. Share image quality is poor for social posting.
   - Current square export keeps nodes too small relative to canvas.
   - Need a social-first export preset (larger node scale, better framing, clearer labels, optional safe margins).
   - Status: TODO (intentionally deferred)

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
   - Goal is preserved route/UI state without disruptive "session checking" flashes when switching tabs/windows.
