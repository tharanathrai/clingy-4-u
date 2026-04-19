import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 pb-24 pt-6 text-text">
      {children}
    </div>
  )
}
