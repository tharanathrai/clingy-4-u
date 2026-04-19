import { useEffect } from 'react'

export function useScrollRestore(storageKey: string, restoreTrigger?: unknown) {
  useEffect(() => {
    const restore = () => {
      const saved = window.sessionStorage.getItem(storageKey)
      const nextY = saved ? Number(saved) : 0
      if (!Number.isFinite(nextY) || nextY <= 0) {
        return
      }

      const maxScrollableY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      )
      const targetY = Math.min(nextY, maxScrollableY)
      window.scrollTo(0, targetY)
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        restore()
      })
    })
  }, [storageKey, restoreTrigger])

  useEffect(() => {
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
