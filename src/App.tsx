import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthGuard } from './components/layout/AuthGuard.tsx'
import { RouteErrorBoundary } from './components/layout/RouteErrorBoundary.tsx'

const LandingPage = lazy(() => import('./pages/Landing.tsx'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallback.tsx'))
const WelcomePage = lazy(() => import('./pages/Welcome.tsx'))
const HomePage = lazy(() => import('./pages/Home.tsx'))
const GraveyardPage = lazy(() => import('./pages/Graveyard.tsx'))
const NetworkPage = lazy(() => import('./pages/Network.tsx'))
const FeedPage = lazy(() => import('./pages/Feed.tsx'))
const NotificationsPage = lazy(() => import('./pages/Notifications.tsx'))
const ProfileMePage = lazy(() => import('./pages/ProfileMe.tsx'))
const ProfilePage = lazy(() => import('./pages/Profile.tsx'))
const AddPage = lazy(() => import('./pages/Add.tsx'))
const AddScanPage = lazy(() => import('./pages/AddScan.tsx'))
const ConnectPage = lazy(() => import('./pages/Connect.tsx'))
const ConnectionRequestsPage = lazy(
  () => import('./pages/ConnectionRequests.tsx'),
)
const PieceNewPage = lazy(() => import('./pages/PieceNew.tsx'))
const PieceDetailPage = lazy(() => import('./pages/PieceDetail.tsx'))
const PieceConfirmPage = lazy(() => import('./pages/PieceConfirm.tsx'))
const SettingsPage = lazy(() => import('./pages/Settings.tsx'))

function App() {
  const location = useLocation()
  const tabRoots = ['/home', '/network', '/feed', '/notifications', '/profile']
  const transitionClassName = tabRoots.some((path) => location.pathname.startsWith(path))
    ? 'app-route-transition-fade'
    : 'app-route-transition-slide-up'

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const setInsets = () => {
      const viewport = window.visualViewport
      if (!viewport) {
        root.style.setProperty('--browser-top-inset', '0px')
        root.style.setProperty('--browser-bottom-inset', '0px')
        return
      }

      const topInset = Math.max(0, viewport.offsetTop)
      const viewportBottomGap = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      )
      // Ignore software keyboard height. We only want browser chrome/safe-area insets.
      const keyboardLikelyOpen = viewportBottomGap > 120
      const bottomInset = keyboardLikelyOpen ? 0 : viewportBottomGap

      root.style.setProperty('--browser-top-inset', `${topInset}px`)
      root.style.setProperty('--browser-bottom-inset', `${bottomInset}px`)
    }

    setInsets()

    const viewport = window.visualViewport
    viewport?.addEventListener('resize', setInsets)
    viewport?.addEventListener('scroll', setInsets)
    window.addEventListener('resize', setInsets)
    window.addEventListener('orientationchange', setInsets)

    return () => {
      viewport?.removeEventListener('resize', setInsets)
      viewport?.removeEventListener('scroll', setInsets)
      window.removeEventListener('resize', setInsets)
      window.removeEventListener('orientationchange', setInsets)
    }
  }, [])

  return (
    <div className="app-device-frame">
      <div className="app-device-screen">
        <div className="fluid-ambient-drift" aria-hidden="true" />
        <div className="grain-overlay" aria-hidden="true" />
        <RouteErrorBoundary>
        <Suspense
          fallback={
            <div className="safe-screen-height flex items-center justify-center bg-bg">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
            </div>
          }
        >
          <div key={location.pathname} className={`app-route-layer ${transitionClassName}`}>
            <Routes location={location}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route
                path="/welcome"
                element={
                  <AuthGuard>
                    <WelcomePage />
                  </AuthGuard>
                }
              />
              <Route
                path="/home"
                element={
                  <AuthGuard>
                    <HomePage />
                  </AuthGuard>
                }
              />
              <Route
                path="/home/graveyard"
                element={
                  <AuthGuard>
                    <GraveyardPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/network"
                element={
                  <AuthGuard>
                    <NetworkPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/feed"
                element={
                  <AuthGuard>
                    <FeedPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/notifications"
                element={
                  <AuthGuard>
                    <NotificationsPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/profile/me"
                element={
                  <AuthGuard>
                    <ProfileMePage />
                  </AuthGuard>
                }
              />
              <Route
                path="/profile/:username"
                element={
                  <AuthGuard>
                    <ProfilePage />
                  </AuthGuard>
                }
              />
              <Route
                path="/add"
                element={
                  <AuthGuard>
                    <AddPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/add/scan"
                element={
                  <AuthGuard>
                    <AddScanPage />
                  </AuthGuard>
                }
              />
              <Route path="/connect" element={<ConnectPage />} />
              <Route
                path="/connections/requests"
                element={
                  <AuthGuard>
                    <ConnectionRequestsPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/piece/new"
                element={
                  <AuthGuard>
                    <PieceNewPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/piece/:id"
                element={
                  <AuthGuard>
                    <PieceDetailPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/piece/:id/confirm"
                element={
                  <AuthGuard>
                    <PieceConfirmPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/settings"
                element={
                  <AuthGuard>
                    <SettingsPage />
                  </AuthGuard>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Suspense>
        </RouteErrorBoundary>
      </div>
    </div>
  )
}

export default App
