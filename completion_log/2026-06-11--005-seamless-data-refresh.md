# Completion: 005-seamless-data-refresh

**Date:** 2026-06-11

## Summary

Standardized React Query refresh behavior across all data hooks and auth gating:

- Added `isInitialQueryLoading`, `debouncedInvalidateQueries`, and expanded `invalidate.ts` helpers
- Hooks expose loading only on initial fetch; cached tab roots render immediately
- Auth no longer flashes loading on token refresh; sign-out clears query cache
- Notifications INSERT queue + confirmation `onBridgeFormed` once-only semantics
- Network retry refetches without wiping graph; Home connections count centralized

## Verified

- `npm run quality` passes (78 tests)
- DEVDOC Refresh & Cache Policy section added; known issues #4/#5 resolved
