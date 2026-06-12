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
