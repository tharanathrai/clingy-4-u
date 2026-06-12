import { describe, expect, it } from 'vitest'
import {
  canNavigateToProfile,
  feedProfileReturnState,
  networkProfileReturnState,
  profileBackReturnState,
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

  describe('canNavigateToProfile (F-01)', () => {
    it('returns false when target is the viewer', () => {
      expect(canNavigateToProfile('user-1', 'user-1')).toBe(false)
    })

    it('returns true when target is another user', () => {
      expect(canNavigateToProfile('user-1', 'user-2')).toBe(true)
    })
  })

  describe('profileBackReturnState (F-03)', () => {
    it('forwards selectUserId and restorePostId to return route', () => {
      expect(
        profileBackReturnState({
          returnTo: '/feed',
          selectUserId: 'user-2',
          restorePostId: 'post-1',
        }),
      ).toEqual({
        selectUserId: 'user-2',
        restorePostId: 'post-1',
      })
    })

    it('returns empty object when no restore keys present', () => {
      expect(profileBackReturnState({ returnTo: '/feed' })).toEqual({})
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
