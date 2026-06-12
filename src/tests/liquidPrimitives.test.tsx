import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GumBlob } from '../components/ui/GumBlob.tsx'
import { LiquidSurface } from '../components/ui/LiquidSurface.tsx'
import { gumMorphClassFromId } from '../lib/gumMorph.ts'

describe('liquid metal primitives', () => {
  it('renders GumBlob with morph and variant classes', () => {
    const { container } = render(
      <GumBlob category="intimate" variant="floating" morphClass="gum-morph-37" />,
    )

    const blob = container.querySelector('.gum-blob')
    expect(blob).toBeTruthy()
    expect(blob?.className).toContain('gum-blob-floating')
    expect(container.querySelector('.gum-morph-37')).toBeTruthy()
    expect(container.querySelector('.gum-blob-specular')).toBeTruthy()
    expect(container.querySelector('.gum-blob-drip')).toBeTruthy()
  })

  it('renders matte GumBlob without floating animation class', () => {
    const { container } = render(<GumBlob category="explore" variant="matte" />)
    const blob = container.querySelector('.gum-blob')
    expect(blob?.className).toContain('gum-blob-matte')
    expect(blob?.className).not.toContain('gum-blob-floating')
  })

  it('renders LiquidSurface elevated variant', () => {
    render(
      <LiquidSurface elevated>
        <p>Liquid card</p>
      </LiquidSurface>,
    )
    expect(screen.getByText('Liquid card')).toBeTruthy()
    expect(screen.getByText('Liquid card').parentElement?.className).toContain(
      'liquid-surface-elevated',
    )
  })

  it('derives desynced morph classes from ids', () => {
    expect(gumMorphClassFromId('abc')).not.toBe(gumMorphClassFromId('abcd'))
  })
})
