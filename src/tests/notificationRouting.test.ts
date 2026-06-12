import { describe, expect, it } from 'vitest'
import {
  resolveStaleGumPieceTap,
  routesToGumPiece,
  shouldCheckGumPieceStatus,
} from '../lib/notificationRouting.ts'

describe('notificationRouting', () => {
  describe('routesToGumPiece', () => {
    it('includes plan_expiring_soon, plan_expired, and invite types', () => {
      expect(routesToGumPiece('plan_expiring_soon')).toBe(true)
      expect(routesToGumPiece('plan_expired')).toBe(true)
      expect(routesToGumPiece('invite_received')).toBe(true)
      expect(routesToGumPiece('invite_accepted')).toBe(true)
      expect(routesToGumPiece('plan_turned_down')).toBe(true)
      expect(routesToGumPiece('bridge_formed')).toBe(false)
    })
  })

  describe('shouldCheckGumPieceStatus', () => {
    it('checks all gum-piece route types (C-03)', () => {
      expect(shouldCheckGumPieceStatus('invite_received')).toBe(true)
      expect(shouldCheckGumPieceStatus('plan_expiring_soon')).toBe(true)
      expect(shouldCheckGumPieceStatus('invite_accepted')).toBe(true)
      expect(shouldCheckGumPieceStatus('plan_turned_down')).toBe(true)
      expect(shouldCheckGumPieceStatus('plan_expired')).toBe(true)
      expect(shouldCheckGumPieceStatus('bridge_formed')).toBe(false)
    })
  })

  describe('resolveStaleGumPieceTap', () => {
    it('dismisses stale plan_expiring_soon on expired piece', () => {
      expect(resolveStaleGumPieceTap('plan_expiring_soon', 'expired')).toEqual({
        dismiss: true,
        toast: 'This plan has already expired.',
      })
    })

    it('dismisses stale plan_expired on expired piece (C-03)', () => {
      expect(resolveStaleGumPieceTap('plan_expired', 'expired')).toEqual({
        dismiss: true,
        toast: 'This plan has already expired.',
      })
    })

    it('continues routing for active plan_expiring_soon', () => {
      expect(resolveStaleGumPieceTap('plan_expiring_soon', 'active')).toEqual({
        dismiss: false,
      })
    })

    it('dismisses stale invite_received on expired piece', () => {
      expect(resolveStaleGumPieceTap('invite_received', 'expired')).toEqual({
        dismiss: true,
        toast: 'This invite has expired.',
      })
    })

    it('dismisses invite_accepted on confirmed piece (C-03)', () => {
      expect(resolveStaleGumPieceTap('invite_accepted', 'confirmed')).toEqual({
        dismiss: true,
        toast: 'This plan is already confirmed.',
      })
    })

    it('dismisses plan_turned_down on turned_down piece (C-03)', () => {
      expect(resolveStaleGumPieceTap('plan_turned_down', 'turned_down')).toEqual({
        dismiss: true,
        toast: 'This plan was turned down.',
      })
    })

    it('continues when piece status is missing', () => {
      expect(resolveStaleGumPieceTap('plan_expiring_soon', null)).toEqual({
        dismiss: false,
      })
      expect(resolveStaleGumPieceTap('plan_expiring_soon', undefined)).toEqual({
        dismiss: false,
      })
    })

    it('continues routing for active invite_accepted', () => {
      expect(resolveStaleGumPieceTap('invite_accepted', 'active')).toEqual({
        dismiss: false,
      })
    })
  })
})
