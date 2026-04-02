import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './components/layout/AuthGuard.tsx'

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
  return (
    <Suspense fallback={<div className="p-5 text-text">Loading...</div>}>
      <Routes>
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
        <Route
          path="/connect"
          element={
            <AuthGuard>
              <ConnectPage />
            </AuthGuard>
          }
        />
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
    </Suspense>
  )
}

export default App
