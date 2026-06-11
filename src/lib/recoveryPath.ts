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
