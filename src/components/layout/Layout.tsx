import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="safe-content-bottom safe-content-top mx-auto min-h-screen w-full max-w-md bg-bg px-5 text-text">
      {children}
    </div>
  )
}
