/** Canonical page shell class strings — see DEVDOC.md Layout Standards */

export const pageShellBase =
  'safe-screen-height mx-auto w-full max-w-md bg-bg px-5 text-text'

export const pageShellScroll = `${pageShellBase} safe-content-top overflow-y-auto pb-8`

export const pageShellTab = `${pageShellBase} safe-content-top safe-content-bottom overflow-y-auto`

export const pageShellCentered = `${pageShellBase} flex flex-col items-center justify-center text-center`

export const pageShellPinnedFooter = `${pageShellBase} flex flex-col pb-[var(--app-safe-bottom)] safe-content-top`

/** Journey push screens with tab bar visible (add/scan, connect) */
export const pageShellJourneyScroll = `${pageShellScroll} pb-tab-clearance flex flex-col`
