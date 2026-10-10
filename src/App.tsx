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
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastViewport />
    </>
  )
}
