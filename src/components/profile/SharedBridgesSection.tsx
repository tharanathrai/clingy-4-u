import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BridgeListItem } from './BridgeListItem.tsx'
import type { Bridge, User } from '../../types/index.ts'

interface SharedBridgesSectionProps {
  bridges: Bridge[]
  otherUser: User
}

export function SharedBridgesSection({
  bridges,
  otherUser,
}: SharedBridgesSectionProps) {
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)

  const sortedBridges = useMemo(() => {
    return [...bridges].sort(
      (a, b) => new Date(b.formed_at).getTime() - new Date(a.formed_at).getTime(),
    )
  }, [bridges])

  const visibleBridges = showAll ? sortedBridges : sortedBridges.slice(0, 5)

  if (bridges.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="font-display text-xl text-text">your bridges together</h2>
        <div className="mt-3 rounded-lg border border-white/10 bg-surface p-5">
          <p className="text-sm text-text-2">No bridges yet. Make a plan.</p>
          <button
            type="button"
            className="mt-4 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white"
            onClick={() => {
              navigate('/piece/new', { state: { recipientId: otherUser.id } })
            }}
          >
            New gum
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl text-text">your bridges together</h2>
      <div className="mt-3 space-y-3">
        {visibleBridges.map((bridge) => (
          <BridgeListItem key={bridge.id} bridge={bridge} otherUser={otherUser} />
        ))}
      </div>
      {!showAll && bridges.length > 5 ? (
        <button
          type="button"
          className="mt-4 rounded-full bg-surface-2 px-5 py-2.5 text-sm text-text-2"
          onClick={() => {
            setShowAll(true)
          }}
        >
          Show all {bridges.length}
        </button>
      ) : null}
    </section>
  )
}
