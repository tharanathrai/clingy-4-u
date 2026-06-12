import type { NavigateFunction } from 'react-router-dom'

/** Cross-route context passed via React Router `location.state`. */
export type AppLocationState = {
  returnTo?: string
  selectUserId?: string
  restorePostId?: string
  recipientId?: string
  toast?: string
}

export function networkProfileReturnState(selectUserId: string): AppLocationState {
  return {
    returnTo: '/network',
    selectUserId,
  }
}

export function feedProfileReturnState(restorePostId?: string): AppLocationState {
  return {
    returnTo: '/feed',
    ...(restorePostId ? { restorePostId } : {}),
  }
}

export function profileNewGumReturnState(
  username: string,
  recipientId: string,
): AppLocationState {
  return {
    recipientId,
    returnTo: `/profile/${username}`,
  }
}

export function canNavigateToProfile(
  viewerId: string | null | undefined,
  targetUserId: string,
): boolean {
  if (!viewerId) {
    return true
  }
  return viewerId !== targetUserId
}

/** State to pass when navigating back via `returnTo` from a profile screen. */
export function profileBackReturnState(state: AppLocationState): AppLocationState {
  return {
    ...(state.selectUserId != null ? { selectUserId: state.selectUserId } : {}),
    ...(state.restorePostId ? { restorePostId: state.restorePostId } : {}),
  }
}

export function navigateToProfile(
  navigate: NavigateFunction,
  options: {
    username: string
    returnTo?: string
    selectUserId?: string
    restorePostId?: string
  },
): void {
  navigate(`/profile/${options.username}`, {
    state: {
      ...(options.returnTo ? { returnTo: options.returnTo } : {}),
      ...(options.selectUserId ? { selectUserId: options.selectUserId } : {}),
      ...(options.restorePostId ? { restorePostId: options.restorePostId } : {}),
    },
  })
}
