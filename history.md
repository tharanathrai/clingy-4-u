# Sticky Bridges — Ralph History

One-line summaries appended after each completed spec.

| Date | Spec | Summary |
|------|------|---------|
| 2026-06-12 | 016-social-share-export | 4:5 Bridge Constellation Card export with stats footer, glow, grain; export-only zoom/labels; 17 new unit tests |
| 2026-06-12 | 016-network-share-export | Canvas ref rAF sync before `canvasReady`; share/save without node selection; error toast; 10 new unit tests |
| 2026-06-12 | 015-feed-profile-navigation | Own-profile feed taps disabled; `restorePostId` round-trip reopens post detail; `canNavigateToProfile` + `profileBackReturnState` |
| 2026-06-12 | 014-contextual-state-audit | Navigation context matrix in DEVDOC; C-01–C-04 fixes; `navigationContext.ts`; extended stale notification routing |
| 2026-06-12 | 013-profile-bridge-detail-fix | Profile shared-bridge sheet hides network CTAs; viewer avatar on bridge detail; `bridgeDetailSheet.test.tsx` |
| 2026-06-12 | 012-notification-routing-hardening | Stale `plan_expiring_soon` tap dismisses notification + toast; `notificationRouting` helper + 6 unit tests |
| 2026-06-12 | 011-regression-matrix-refresh | Manual matrix items 1–14 documented; 0 fail; stale DEVDOC labels refreshed; 97 unit + 18 E2E pass |
| 2026-06-12 | 010-profile-back-e2e | Playwright E2E for feed/network/cold-open profile back navigation; own-profile regression test |
| 2026-06-12 | 009-plan-expiring-soon-cron | `run-expiry` emits idempotent `plan_expiring_soon` notifications + optional email within 30-day window |
| 2026-06-11 | 008-pending-flows-completion-plan | Post-MVP flow audit; `IMPLEMENTATION_PLAN.md`; P1 queue specs 009–012 |
| 2026-06-11 | 007-profile-back-navigation | `BackHeader` on other-user `/profile/:username`; history/`returnTo` back; network passes restore state |
| 2026-06-11 | 006-notifications-icon-cursor | Mark-all-read icon button on `/notifications`; shared `iconButtonClassName`; fine-pointer hover cursors app-wide |
| 2026-06-11 | 005-seamless-data-refresh | Stale-while-revalidate loading, debounced invalidation, centralized queryKeys/invalidate, auth stability |
| 2026-06-11 | 004-onboarding-journey-consistency | Journey screens use pageShell tokens; /add true pinned footer; pageShellJourneyScroll for scan/connect |
| 2026-06-11 | 003-ui-consistency-audit | Unified page shells (BackHeader, pageShell tokens), removed min-h-screen drift, sentence-case titles, DEVDOC layout standards |
| 2026-06-11 | 002-onboarding-robustness | Fixed onboarding viewport layout, OAuth back-nav recovery, and error boundary Go home/Try again |
| 2026-06-11 | 001-profile-graveyard-icon | Moved graveyard access from bottom text link to top-left header icon on `/profile/me` |
| 2026-06-11 | — | Ralph Wiggum installed |
