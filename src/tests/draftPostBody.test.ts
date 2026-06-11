import { describe, expect, it } from 'vitest'
import { buildDraftPostBody } from '../lib/draftPostBody.ts'

describe('buildDraftPostBody', () => {
  it('uses category-specific verbs', () => {
    expect(
      buildDraftPostBody({
        creatorName: 'Maya',
        recipientName: 'Jordan',
        title: 'hiking',
        category: 'active',
      }),
    ).toBe('Maya and Jordan went hiking.')
  })

  it('strips trailing punctuation from the title', () => {
    expect(
      buildDraftPostBody({
        creatorName: 'Maya',
        recipientName: 'Jordan',
        title: 'coffee.',
        category: 'savor',
      }),
    ).toBe('Maya and Jordan shared coffee.')
  })
})
