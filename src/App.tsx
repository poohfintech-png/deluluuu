import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { BottomNav } from '@/components/BottomNav'
import { ProtectedRoute, AdminRoute, WriterRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { HomePage } from '@/pages/HomePage'
import { AuthPage } from '@/pages/AuthPage'
import { BookPage } from '@/pages/BookPage'
import { ChapterReaderPage } from '@/pages/ChapterReaderPage'
import { ReaderDashboardPage } from '@/pages/ReaderDashboardPage'
import { SubscribePage } from '@/pages/SubscribePage'
import { ReelsPage } from '@/pages/ReelsPage'
import { DramaDetailPage } from '@/pages/DramaDetailPage'
import { EpisodePlayerPage } from '@/pages/EpisodePlayerPage'
import { AudiobooksPage } from '@/pages/AudiobooksPage'
import { JoinWriterPage } from '@/pages/JoinWriterPage'
import { UserProfilePage } from '@/pages/UserProfilePage'
import { WriterDashboardPage } from '@/pages/WriterDashboardPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminBooksPage } from '@/pages/admin/AdminBooksPage'
import { AdminChaptersPage } from '@/pages/admin/AdminChaptersPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AdminPaymentsPage } from '@/pages/admin/AdminPaymentsPage'
import { AdminCommentsPage } from '@/pages/admin/AdminCommentsPage'
import { AdminReelsPage } from '@/pages/admin/AdminReelsPage'
import { AdminWriterApplicationsPage } from '@/pages/admin/AdminWriterApplicationsPage'
import { AdminFeatureFlagsPage } from '@/pages/admin/AdminFeatureFlagsPage'
import { AdminGenresPage } from '@/pages/admin/AdminGenresPage'
import { AdminHomepagePage } from '@/pages/admin/AdminHomepagePage'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import { AdminMembershipPlansPage } from '@/pages/admin/AdminMembershipPlansPage'
import { AdminPaymentSettingsPage } from '@/pages/admin/AdminPaymentSettingsPage'
import { AdminSecurityPage } from '@/pages/admin/AdminSecurityPage'
import { AdminRecycleBinPage } from '@/pages/admin/AdminRecycleBinPage'

export default function App() {
  const { loading, isAdmin } = useAuth()
  const { maintenanceMode } = useFeatureFlags()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-serif italic">Delulu</p>
        </div>
      </div>
    )
  }

  // Maintenance mode: non-admins see maintenance page, admins can still access everything
  if (maintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 mx-auto mb-6 flex items-center justify-center">
            <span className="font-serif text-2xl font-semibold text-primary">D</span>
          </div>
          <h1 className="font-serif text-3xl font-semibold mb-3">We'll be right back</h1>
          <p className="text-muted-foreground">DELULU is undergoing scheduled maintenance. Please check back soon.</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        <Route
          path="/control-panel/*"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<ErrorBoundary><AdminDashboardPage /></ErrorBoundary>} />
          <Route path="books" element={<ErrorBoundary><AdminBooksPage /></ErrorBoundary>} />
          <Route path="chapters" element={<ErrorBoundary><AdminChaptersPage /></ErrorBoundary>} />
          <Route path="reels" element={<ErrorBoundary><AdminReelsPage /></ErrorBoundary>} />
          <Route path="genres" element={<ErrorBoundary><AdminGenresPage /></ErrorBoundary>} />
          <Route path="writers" element={<ErrorBoundary><AdminWriterApplicationsPage /></ErrorBoundary>} />
          <Route path="feature-flags" element={<ErrorBoundary><AdminFeatureFlagsPage /></ErrorBoundary>} />
          <Route path="users" element={<ErrorBoundary><AdminUsersPage /></ErrorBoundary>} />
          <Route path="payments" element={<ErrorBoundary><AdminPaymentsPage /></ErrorBoundary>} />
          <Route path="comments" element={<ErrorBoundary><AdminCommentsPage /></ErrorBoundary>} />
          <Route path="homepage" element={<ErrorBoundary><AdminHomepagePage /></ErrorBoundary>} />
          <Route path="plans" element={<ErrorBoundary><AdminMembershipPlansPage /></ErrorBoundary>} />
          <Route path="payment-settings" element={<ErrorBoundary><AdminPaymentSettingsPage /></ErrorBoundary>} />
          <Route path="security" element={<ErrorBoundary><AdminSecurityPage /></ErrorBoundary>} />
          <Route path="recycle-bin" element={<ErrorBoundary><AdminRecycleBinPage /></ErrorBoundary>} />
        </Route>

        <Route
          path="/*"
          element={
            <>
              <Navbar />
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/reels" element={<ReelsPage />} />
                  <Route path="/audiobooks" element={<AudiobooksPage />} />
                  <Route path="/drama/:dramaId" element={<DramaDetailPage />} />
                  <Route path="/drama/:dramaId/episode/:episodeId" element={<EpisodePlayerPage />} />
                  <Route path="/book/:bookId" element={<BookPage />} />
                  <Route
                    path="/book/:bookId/chapter/:chapterId"
                    element={
                      <ProtectedRoute>
                        <ChapterReaderPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <ReaderDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <UserProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/writer-dashboard"
                    element={
                      <WriterRoute>
                        <WriterDashboardPage />
                      </WriterRoute>
                    }
                  />
                  <Route path="/writer" element={<JoinWriterPage />} />
                  <Route
                    path="/subscribe"
                    element={
                      <ProtectedRoute>
                        <SubscribePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
              <div className="hidden md:block"><Footer /></div>
              <BottomNav />
              <div className="h-16 md:hidden" />
            </>
          }
        />
      </Routes>
    </ErrorBoundary>
  )
}
