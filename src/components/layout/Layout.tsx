import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="safe-content-bottom mx-auto min-h-screen w-full max-w-md bg-bg px-5 pt-6 text-text">
      {children}
    </div>
  )
}
