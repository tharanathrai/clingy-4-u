import { describe, expect, it } from 'vitest'
import {
  feedProfileReturnState,
  networkProfileReturnState,
  profileNewGumReturnState,
} from '../lib/navigationContext.ts'

describe('navigationContext', () => {
  describe('networkProfileReturnState (C-01)', () => {
    it('includes returnTo and selectUserId for network graph restore', () => {
      expect(networkProfileReturnState('user-2')).toEqual({
        returnTo: '/network',
        selectUserId: 'user-2',
      })
    })
  })

  describe('profileNewGumReturnState (C-02)', () => {
    it('returns profile path as returnTo with recipientId', () => {
      expect(profileNewGumReturnState('jordan', 'user-2')).toEqual({
        recipientId: 'user-2',
        returnTo: '/profile/jordan',
      })
    })
  })

  describe('feedProfileReturnState (C-04)', () => {
    it('includes returnTo feed without restorePostId by default', () => {
      expect(feedProfileReturnState()).toEqual({ returnTo: '/feed' })
    })

    it('includes restorePostId when provided', () => {
      expect(feedProfileReturnState('post-1')).toEqual({
        returnTo: '/feed',
        restorePostId: 'post-1',
      })
    })
  })
})
