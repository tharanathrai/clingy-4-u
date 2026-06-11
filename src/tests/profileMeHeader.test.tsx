/**
 * Tests for src/components/profile/ProfileMeHeader.tsx
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProfileMeHeader, ProfileMeHeaderSkeleton } from '../components/profile/ProfileMeHeader.tsx'

describe('ProfileMeHeader', () => {
  it('links to graveyard from the top-left icon button', () => {
    render(
      <MemoryRouter>
        <ProfileMeHeader />
      </MemoryRouter>,
    )

    const graveyardLink = screen.getByRole('link', { name: 'Graveyard' })
    expect(graveyardLink).toHaveAttribute('href', '/home/graveyard')
  })

  it('links to settings from the top-right icon button', () => {
    render(
      <MemoryRouter>
        <ProfileMeHeader />
      </MemoryRouter>,
    )

    const settingsLink = screen.getByRole('link', { name: 'Settings' })
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })
})

describe('ProfileMeHeaderSkeleton', () => {
  it('renders two icon button placeholders', () => {
    const { container } = render(<ProfileMeHeaderSkeleton />)
    expect(container.querySelectorAll('.skeleton')).toHaveLength(2)
  })
})
