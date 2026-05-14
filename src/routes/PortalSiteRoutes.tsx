import { lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RedirectToAppOrigin } from '../components/CrossDomainRedirects'
import { RedirectToAppSignup } from '../components/RedirectToAppSignup'
import { ParentShell } from '../components/ParentShell'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { PublicRoute } from '../components/PublicRoute'
import { AuthLayout } from '../pages/auth/AuthLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage'
import { useAuth } from '../lib/auth'
import { redirectToStaffApp } from '../lib/site'

const ParentPortalPage = lazy(() => import('../pages/portal/ParentPortalPage').then((m) => ({ default: m.ParentPortalPage })))
const StudentProfilePage = lazy(() => import('../pages/dashboard/StudentProfilePage').then((m) => ({ default: m.StudentProfilePage })))

function PortalRoot() {
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (loading || !user || !profile) return
    if (profile.role !== 'parent') redirectToStaffApp('/dashboard')
  }, [loading, user, profile])

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading session…</div>
  if (!user) return <Navigate to="/auth/login" replace />
  if (profile?.role === 'parent') return <Navigate to="/portal" replace />
  return <div className="p-6 text-sm text-slate-500">Redirecting to the school app…</div>
}

export function PortalSiteRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PortalRoot />} />
      <Route path="/dashboard/*" element={<RedirectToAppOrigin />} />
      <Route path="/kiosk/*" element={<RedirectToAppOrigin />} />
      <Route element={<PublicRoute />}>
        <Route path="/auth" element={<AuthLayout variant="portal" />}>
          <Route index element={<Navigate to="/auth/login" replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<RedirectToAppSignup />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
        <Route element={<ParentShell />}>
          <Route path="/portal" element={<ParentPortalPage />} />
          <Route path="/portal/student/:studentId" element={<StudentProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
