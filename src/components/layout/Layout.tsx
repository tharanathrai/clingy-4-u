import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="safe-screen-height mx-auto w-full max-w-md overflow-hidden bg-bg text-text">
      <div className="safe-content-bottom safe-content-top h-full overflow-y-auto px-5">
        {children}
      </div>
    </div>
  )
}
