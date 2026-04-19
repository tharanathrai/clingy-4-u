import { useEffect } from 'react'

export function useScrollRestore(storageKey: string) {
  useEffect(() => {
    const saved = window.sessionStorage.getItem(storageKey)
    const nextY = saved ? Number(saved) : 0
    if (Number.isFinite(nextY) && nextY > 0) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, nextY)
        })
      })
    }

    const onScroll = () => {
      window.sessionStorage.setItem(storageKey, String(window.scrollY))
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.sessionStorage.setItem(storageKey, String(window.scrollY))
    }
  }, [storageKey])
}
