/**
 * Tests for src/lib/categorizeTitle.ts
 *
 * Each test uses inputs that unambiguously score highest in one category,
 * avoiding the partial-substring scoring that single-letter words can trigger.
 */

import { describe, it, expect } from 'vitest'
import { categorizeTitle } from '../lib/categorizeTitle.ts'

describe('categorizeTitle', () => {
  it('categorises dinner as savor', () => {
    expect(categorizeTitle('dinner out with friends')).toBe('savor')
  })

  it('categorises hiking as active', () => {
    expect(categorizeTitle('hiking trip this weekend')).toBe('active')
  })

  it('categorises movie night as intimate', () => {
    expect(categorizeTitle('movie night at mine')).toBe('intimate')
  })

  it('categorises yoga as recharge', () => {
    expect(categorizeTitle('yoga session Saturday morning')).toBe('recharge')
  })

  it('categorises karaoke as playful', () => {
    expect(categorizeTitle('karaoke night downtown')).toBe('playful')
  })

  it('categorises museum visit as explore', () => {
    expect(categorizeTitle('museum visit next week')).toBe('explore')
  })

  it('categorises help moving as support', () => {
    expect(categorizeTitle('help with moving boxes on Sunday')).toBe('support')
  })

  it('returns explore for completely unrecognised input', () => {
    expect(categorizeTitle('zzz nothing here zzz')).toBe('explore')
    expect(categorizeTitle('')).toBe('explore')
  })

  it('is case-insensitive', () => {
    expect(categorizeTitle('DINNER TOGETHER')).toBe('savor')
    expect(categorizeTitle('Yoga Class')).toBe('recharge')
  })

  it('handles partial stem matching (hiking → active)', () => {
    expect(categorizeTitle('went hiking in the mountains')).toBe('active')
  })

  it('handles road trip as explore', () => {
    expect(categorizeTitle('road trip this weekend')).toBe('explore')
  })
})
