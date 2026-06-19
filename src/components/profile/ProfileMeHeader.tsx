import { Ghost, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { iconButtonClassName } from '../../lib/iconButton.ts'

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
