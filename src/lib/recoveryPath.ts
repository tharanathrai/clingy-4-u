/**
 * sessionStorage key holding the post-auth return target (e.g. `/connect?token=...`).
 * Written before OAuth, consumed after sign-in. Kept durable through onboarding so a new
 * user's connect intent survives the `/welcome` redirect instead of riding volatile router state.
 */
export const postAuthReturnToKey = 'postAuthReturnTo'

export function resolveRecoveryPath(options: {
  hasUser: boolean
  profileReady: boolean | null
  authLoading: boolean
  profileLoading: boolean
}): string {
  if (options.authLoading || options.profileLoading) {
    return '/'
  }

  if (!options.hasUser) {
    return '/'
  }

  if (!options.profileReady) {
    return '/welcome'
  }

  return '/home'
}

export function resolvePostAuthPath(
  hasProfile: boolean,
  storedReturnTo: string | null,
): string {
  if (hasProfile && storedReturnTo?.startsWith('/')) {
    return storedReturnTo
  }

  return hasProfile ? '/home' : '/welcome'
}
