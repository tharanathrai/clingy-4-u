# Completion: 015-feed-profile-navigation

**Date:** 2026-06-12  
**Spec:** `specs/015-feed-profile-navigation/spec.md`

## Shipped

- F-01: `canNavigateToProfile` gates own-profile author taps on feed list and post detail
- F-02: Post detail `onAuthorPress` wired for other users via `navigateToProfile`
- F-03: `profileBackReturnState` forwards `restorePostId`; `Feed` reopens post detail on return
- F-04: Feed list author taps use `navigateToProfile` with `returnTo: '/feed'`
- C-04 stretch: overlay restore after profile back from post detail

## Tests

- `feedProfileNavigation.test.tsx` 3/3
- `navigationContext.test.ts` extended (+4 cases)
- `profileUser.test.tsx` +1 (`restorePostId` forward)
- Playwright `profile-back.spec.ts` 6/6 (new F-03 E2E)

## Quality

- `npm run quality` pass (125 unit tests)
