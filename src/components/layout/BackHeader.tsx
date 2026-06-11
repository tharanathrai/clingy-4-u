import { ArrowLeft } from 'lucide-react'
import { Link, type To } from 'react-router-dom'

interface BackHeaderProps {
  to?: To
  onBack?: () => void
  label?: string
  className?: string
}

const backControlClassName =
  'inline-flex min-h-11 min-w-11 items-center gap-2 self-start text-sm text-text-2'

export function BackHeader({
  to,
  onBack,
  label = 'back',
  className = '',
}: BackHeaderProps) {
  const classNames = `${backControlClassName} ${className}`.trim()

  if (to) {
    return (
      <Link to={to} className={classNames}>
        <ArrowLeft size={18} strokeWidth={1.75} />
        {label}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onBack} className={classNames}>
      <ArrowLeft size={18} strokeWidth={1.75} />
      {label}
    </button>
  )
}
