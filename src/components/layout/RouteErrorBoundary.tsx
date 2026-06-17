import { Component, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.ts'
import { useProfileReady } from '../../hooks/useProfileReady.ts'
import { resolveRecoveryPath } from '../../lib/recoveryPath.ts'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  resetKey: number
}

interface RouteErrorFallbackProps {
  onTryAgain: () => void
  onGoHome: () => void
}

function RouteErrorFallback({ onTryAgain, onGoHome }: RouteErrorFallbackProps) {
  return (
    <main className="safe-screen-height flex flex-col items-center justify-center gap-6 bg-bg px-5 text-text">
      <h1 className="font-display text-4xl">Something broke.</h1>
      <p className="text-sm text-text-2">
        It's not you — this page ran into a problem. Tap below to recover.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded-full bg-surface-2 px-6 py-3 text-sm text-text-2"
          onClick={onTryAgain}
        >
          Try again
        </button>
        <button
          type="button"
          className="btn-primary rounded-full bg-accent px-6 py-3 text-sm font-medium text-white"
          onClick={onGoHome}
        >
          Go home
        </button>
      </div>
    </main>
  )
}

function RouteErrorFallbackWithNavigation({
  onTryAgain,
}: {
  onTryAgain: () => void
}) {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { profileReady, isLoading: profileLoading } = useProfileReady(user?.id ?? null)

  const handleGoHome = () => {
    onTryAgain()
    const destination = resolveRecoveryPath({
      hasUser: Boolean(user),
      profileReady,
      authLoading,
      profileLoading,
    })
    navigate(destination, { replace: true })
  }

  return <RouteErrorFallback onTryAgain={onTryAgain} onGoHome={handleGoHome} />
}

/**
 * Catches uncaught errors thrown inside any route so a single broken page
 * cannot black-screen the entire app. Falls back to a recoverable error UI
 * that matches DESIGN.md voice and gives the user a way out.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, resetKey: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[RouteErrorBoundary]', error, info.componentStack)
  }

  handleTryAgain = () => {
    this.setState((state) => ({
      error: null,
      resetKey: state.resetKey + 1,
    }))
  }

  override render() {
    if (this.state.error) {
      return <RouteErrorFallbackWithNavigation onTryAgain={this.handleTryAgain} />
    }

    return <div key={this.state.resetKey}>{this.props.children}</div>
  }
}

export { RouteErrorFallback }
