import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pageShellCentered } from '../components/layout/pageShell.ts'
import { postAuthReturnToKey, resolvePostAuthPath } from '../lib/recoveryPath.ts'
import { supabase } from '../lib/supabase.ts'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const handleCallback = async () => {
      const storedReturnTo = sessionStorage.getItem(postAuthReturnToKey)

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()

        if (authError || !authData.user) {
          if (!cancelled) {
            navigate('/?error=auth_callback_failed', { replace: true })
          }
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id')
          .eq('id', authData.user.id)
          .maybeSingle()

        if (profileError) {
          if (!cancelled) {
            navigate('/?error=profile_lookup_failed', { replace: true })
          }
          return
        }

        if (!cancelled) {
          const hasProfile = Boolean(profile)
          // Existing users go straight to their return target — the key has done its job.
          // New users land on /welcome; keep the key in sessionStorage so onboarding can
          // resume the connect flow instead of relying on (strippable) router state.
          if (hasProfile) {
            sessionStorage.removeItem(postAuthReturnToKey)
          }
          navigate(resolvePostAuthPath(hasProfile, storedReturnTo), { replace: true })
        }
      } catch (error) {
        console.error('[AuthCallback]', error)
        if (!cancelled) {
          navigate('/', { replace: true })
        }
      }
    }

    void handleCallback()

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void handleCallback()
      }
    }

    window.addEventListener('pageshow', handlePageShow)

    return () => {
      cancelled = true
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [navigate])

  return (
    <main className={pageShellCentered}>
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-text-3 border-t-accent" />
        <p className="text-sm text-text-2">Signing you in...</p>
      </div>
    </main>
  )
}
