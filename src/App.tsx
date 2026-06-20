import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthGuard } from './components/layout/AuthGuard.tsx'
import { RouteErrorBoundary } from './components/layout/RouteErrorBoundary.tsx'
import { FullScreenSpinner } from './components/Spinner.tsx'
import { track } from './lib/analytics.ts'

// Collapse dynamic segments so no id / username ever lands in analytics.
function normalizeSurface(pathname: string): string {
  return pathname
    .replace(/\/piece\/[^/]+/, '/piece/:id')
    .replace(/\/profile\/(?!me$)[^/]+/, '/profile/:username')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
}

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
    track('screen_view', undefined, normalizeSurface(location.pathname))
  }, [location.pathname])

  // Browser chrome (URL bar) is handled natively by CSS `100dvh`, and notch safe-areas by
  // `env(safe-area-inset-*)`. The old JS visualViewport hack re-subtracted the chrome that dvh
  // already excludes (double-count → short content / layout jumps), so it has been removed.
  // --browser-*-inset stay at their 0px defaults from index.css.

  return (
    <div className="app-device-frame">
      <div className="app-device-screen">
        <div className="grain-overlay" aria-hidden="true" />
        <RouteErrorBoundary>
        <Suspense fallback={<FullScreenSpinner />}>
          <div key={location.pathname} className={transitionClassName}>
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
