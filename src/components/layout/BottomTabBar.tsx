import {
  Bell,
  CircleUserRound,
  Home,
  Share2,
  Waypoints,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications.ts'

interface TabConfig {
  to: string
  label: string
  icon: ComponentType<{
    size?: number
    strokeWidth?: number
    className?: string
  }>
  hasBadge?: boolean
}

const tabs: TabConfig[] = [
  { to: '/home', label: 'Pocket', icon: Home },
  { to: '/network', label: 'Network', icon: Waypoints },
  { to: '/feed', label: 'Feed', icon: Share2 },
  { to: '/notifications', label: 'Notifications', icon: Bell, hasBadge: true },
  { to: '/profile/me', label: 'Profile', icon: CircleUserRound },
]

export function BottomTabBar() {
  const location = useLocation()
  const { unreadCount } = useNotifications()

  return (
    <nav className="app-fixed-frame bottom-0 z-40 border-t border-white/10 bg-surface">
      <div className="app-fixed-frame-inner safe-bottom-tab flex w-full items-center justify-between px-5 pb-0.5 pt-1.5">
        {tabs.map((tab) => {
          const isActive =
            location.pathname === tab.to ||
            (tab.to !== '/' && location.pathname.startsWith(tab.to))
          const Icon = tab.icon
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className="relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1"
            >
              <span className="relative">
                <Icon
                  size={22}
                  strokeWidth={1.75}
                  className={isActive ? 'text-accent' : 'text-text-3'}
                />
                {tab.hasBadge && unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-playful" />
                ) : null}
              </span>
              <span
                className={`text-xs font-medium ${
                  isActive ? 'text-accent' : 'text-text-3'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
