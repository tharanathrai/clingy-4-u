import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches uncaught errors thrown inside any route so a single broken page
 * cannot black-screen the entire app. Falls back to a recoverable error UI
 * that matches DESIGN.md voice and gives the user a way out.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log internally without exposing to user; swap for Sentry/Datadog later
    console.error('[RouteErrorBoundary]', error, info.componentStack)
  }

  override render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-5 text-text">
          <h1 className="font-display text-4xl">Something broke.</h1>
          <p className="text-sm text-text-2">
            It's not you — this page ran into a problem. Tap below to recover.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-full bg-surface-2 px-6 py-3 text-sm text-text-2"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <Link
              to="/home"
              className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white"
              onClick={() => this.setState({ error: null })}
            >
              Go home
            </Link>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
