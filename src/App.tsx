import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { PlainLayout } from '@/layouts/PlainLayout'
import { ToastViewport } from '@/components/ui'
import { RequireAuth } from '@/components/RequireAuth'

import LandingPage from '@/pages/LandingPage'
import AuthPage from '@/pages/AuthPage'
import OnboardingPage from '@/pages/OnboardingPage'
import DashboardPage from '@/pages/DashboardPage'
import LibraryPage from '@/pages/library/LibraryPage'
import LibraryBoardPage from '@/pages/library/LibraryBoardPage'
import LibraryClassPage from '@/pages/library/LibraryClassPage'
import LibrarySubjectPage from '@/pages/library/LibrarySubjectPage'
import LibraryChapterPage from '@/pages/library/LibraryChapterPage'
import PyqHomePage from '@/pages/pyq/PyqHomePage'
import PyqRoutePage from '@/pages/pyq/PyqRoutePage'
import PyqPaperPage from '@/pages/pyq/PyqPaperPage'
import AiTutorPage from '@/pages/AiTutorPage'
import MistakeBookPage from '@/pages/MistakeBookPage'
import ProgressPage from '@/pages/ProgressPage'
import PlannerPage from '@/pages/PlannerPage'
import FormulaFlowPage from '@/pages/FormulaFlowPage'
import ReactionLabPage from '@/pages/ReactionLabPage'
import ProfilePage from '@/pages/ProfilePage'
import SettingsPage from '@/pages/SettingsPage'

import { AdminLayout } from '@/admin/layout/AdminLayout'
import { RequireAdmin } from '@/admin/guards/RequireAdmin'
import AdminLoginPage from '@/admin/pages/AdminLoginPage'
import AdminDashboardPage from '@/admin/pages/AdminDashboardPage'
import AdminAnalyticsPage from '@/admin/pages/AdminAnalyticsPage'
import AdminAiPage from '@/admin/pages/AdminAiPage'
import AdminContentPage from '@/admin/pages/AdminContentPage'
import AdminResourceFormPage from '@/admin/pages/AdminResourceFormPage'
import AdminPyqPage from '@/admin/pages/AdminPyqPage'
import AdminPyqFormPage from '@/admin/pages/AdminPyqFormPage'
import AdminPyqImportPage from '@/admin/pages/AdminPyqImportPage'
import AdminAcademicPage from '@/admin/pages/AdminAcademicPage'
import ContentEnginePage from '@/admin/pages/ContentEnginePage'
import ContentEngineJobsPage from '@/admin/pages/ContentEngineJobsPage'
import ContentEngineReviewPage from '@/admin/pages/ContentEngineReviewPage'
import ContentEngineSourcesPage from '@/admin/pages/ContentEngineSourcesPage'
import ContentEngineCoveragePage from '@/admin/pages/ContentEngineCoveragePage'
import ContentEnginePyqDiscoveryPage from '@/admin/pages/ContentEnginePyqDiscoveryPage'
import AdminBoardsPage from '@/admin/pages/AdminBoardsPage'
import AdminClassesPage from '@/admin/pages/AdminClassesPage'
import AdminStreamsPage from '@/admin/pages/AdminStreamsPage'
import AdminSubjectsPage from '@/admin/pages/AdminSubjectsPage'
import AdminChaptersPage from '@/admin/pages/AdminChaptersPage'
import AdminUsersPage from '@/admin/pages/AdminUsersPage'
import AdminUserDetailPage from '@/admin/pages/AdminUserDetailPage'
import AdminReportsPage from '@/admin/pages/AdminReportsPage'
import AdminSettingsPage from '@/admin/pages/AdminSettingsPage'
import AdminAuditPage from '@/admin/pages/AdminAuditPage'

/**
 * Route map.
 *
 * Library and PYQ URLs are deliberately shaped so every level has a unique
 * URI — React Router cannot disambiguate `/pyq/physics` (subject) from a paper
 * slug on the same segment, so `PyqRoutePage` resolves that pair.
 *
 * Screens that show *personal* data sit behind `RequireAuth`; the Library and
 * PYQ archive stay open for public academic browsing.
 */
export default function App() {
  return (
    <>
      <Routes>
        {/* Marketing + auth + onboarding — no app chrome */}
        <Route element={<PlainLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <OnboardingPage />
              </RequireAuth>
            }
          />
        </Route>

        {/* Signed-in app */}
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />

          {/* Public academic browsing */}
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:board" element={<LibraryBoardPage />} />
          <Route path="/library/:board/:class" element={<LibraryClassPage />} />
          <Route path="/library/:board/:class/:subject" element={<LibrarySubjectPage />} />
          <Route path="/library/:board/:class/:subject/:chapter" element={<LibraryChapterPage />} />

          <Route path="/pyq" element={<PyqHomePage />} />
          <Route path="/pyq/:slug" element={<PyqRoutePage />} />
          <Route path="/pyq/:subject/:paper" element={<PyqPaperPage />} />

          <Route
            path="/ai-tutor"
            element={
              <RequireAuth>
                <AiTutorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/mistakebook"
            element={
              <RequireAuth>
                <MistakeBookPage />
              </RequireAuth>
            }
          />
          <Route
            path="/progress"
            element={
              <RequireAuth>
                <ProgressPage />
              </RequireAuth>
            }
          />
          <Route
            path="/planner"
            element={
              <RequireAuth>
                <PlannerPage />
              </RequireAuth>
            }
          />

          {/* Content labs — bundled study material, no account required */}
          <Route path="/formula-flow" element={<FormulaFlowPage />} />
          <Route path="/reaction-lab" element={<ReactionLabPage />} />

          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />

          {/* Admin → AI lives in the portal's own route tree (below) */}
        </Route>

        {/* ---------------------------------------------------------------- */}
        {/* Admin Portal — every screen is guarded; the database re-checks    */}
        {/* each privileged read/write regardless (RLS + admin_* RPCs).      */}
        {/* ---------------------------------------------------------------- */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="ai" element={<AdminAiPage />} />

          {/* Content */}
          <Route path="content" element={<AdminContentPage />} />
          <Route path="content/resources/new" element={<AdminResourceFormPage />} />
          <Route path="content/resources/:id" element={<AdminResourceFormPage />} />
          <Route path="content/pyq" element={<AdminPyqPage />} />
          <Route path="content/pyq/import" element={<AdminPyqImportPage />} />
          <Route path="content/pyq/new" element={<AdminPyqFormPage />} />
          <Route path="content/pyq/:id" element={<AdminPyqFormPage />} />

          {/* Autonomous Content Engine */}
          <Route path="content-engine" element={<ContentEnginePage />} />
          <Route path="content-engine/jobs" element={<ContentEngineJobsPage />} />
          <Route path="content-engine/review" element={<ContentEngineReviewPage />} />
          <Route path="content-engine/sources" element={<ContentEngineSourcesPage />} />
          <Route path="content-engine/coverage" element={<ContentEngineCoveragePage />} />
          <Route path="content-engine/pyq-discovery" element={<ContentEnginePyqDiscoveryPage />} />

          {/* Academic hierarchy */}
          <Route path="academic" element={<AdminAcademicPage />} />
          <Route path="academic/boards" element={<AdminBoardsPage />} />
          <Route path="academic/classes" element={<AdminClassesPage />} />
          <Route path="academic/streams" element={<AdminStreamsPage />} />
          <Route path="academic/subjects" element={<AdminSubjectsPage />} />
          <Route path="academic/chapters" element={<AdminChaptersPage />} />

          {/* People + moderation */}
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="reports" element={<AdminReportsPage />} />

          {/* System */}
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastViewport />
    </>
  )
}
