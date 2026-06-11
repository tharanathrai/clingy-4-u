import { Ghost, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

const iconButtonClassName =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-surface text-text-2 transition hover:border-white/25 hover:bg-surface-2 active:scale-95'

export function ProfileMeHeader() {
  return (
    <div className="flex items-center justify-between">
      <Link
        to="/home/graveyard"
        className={iconButtonClassName}
        aria-label="Graveyard"
      >
        <Ghost size={18} strokeWidth={1.75} />
      </Link>
      <Link
        to="/settings"
        className={iconButtonClassName}
        aria-label="Settings"
      >
        <Settings size={18} strokeWidth={1.75} />
      </Link>
    </div>
  )
}

export function ProfileMeHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="skeleton h-11 w-11 rounded-full" />
      <div className="skeleton h-11 w-11 rounded-full" />
    </div>
  )
}
