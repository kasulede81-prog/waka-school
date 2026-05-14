import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RedirectToPortalOrigin } from '../components/CrossDomainRedirects'
import { ParentShell } from '../components/ParentShell'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { PublicRoute } from '../components/PublicRoute'
import { AuthLayout } from '../pages/auth/AuthLayout'
import { SignupPage } from '../pages/auth/SignupPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage'
import { StaffQrKioskPage } from '../pages/kiosk/StaffQrKioskPage'
import { getSiteKind } from '../lib/site'

const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AttendancePage = lazy(() => import('../pages/dashboard/AttendancePage').then((m) => ({ default: m.AttendancePage })))
const ClassAttendanceRegisterPage = lazy(() =>
  import('../pages/dashboard/ClassAttendanceRegisterPage').then((m) => ({ default: m.ClassAttendanceRegisterPage })),
)
const StaffQrManagementPage = lazy(() => import('../pages/dashboard/StaffQrManagementPage').then((m) => ({ default: m.StaffQrManagementPage })))
const AcademicsPage = lazy(() => import('../pages/dashboard/AcademicsPage').then((m) => ({ default: m.AcademicsPage })))
const FeesPage = lazy(() => import('../pages/dashboard/FeesPage').then((m) => ({ default: m.FeesPage })))
const FinancePage = lazy(() => import('../pages/dashboard/FinancePage').then((m) => ({ default: m.FinancePage })))
const FinanceOpsPage = lazy(() => import('../pages/dashboard/FinanceOpsPage').then((m) => ({ default: m.FinanceOpsPage })))
const ReconciliationCenterPage = lazy(() =>
  import('../pages/dashboard/ReconciliationCenterPage').then((m) => ({ default: m.ReconciliationCenterPage })),
)
const SearchPage = lazy(() => import('../pages/dashboard/SearchPage').then((m) => ({ default: m.SearchPage })))
const StudentsPage = lazy(() => import('../pages/dashboard/StudentsPage').then((m) => ({ default: m.StudentsPage })))
const StudentProfilePage = lazy(() => import('../pages/dashboard/StudentProfilePage').then((m) => ({ default: m.StudentProfilePage })))
const AdminOpsPage = lazy(() => import('../pages/dashboard/AdminOpsPage').then((m) => ({ default: m.AdminOpsPage })))
const ApprovalsPage = lazy(() => import('../pages/dashboard/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })))
const ReliabilityPage = lazy(() => import('../pages/dashboard/ReliabilityPage').then((m) => ({ default: m.ReliabilityPage })))
const JobsQueuePage = lazy(() => import('../pages/dashboard/JobsQueuePage').then((m) => ({ default: m.JobsQueuePage })))
const CommunicationsHubPage = lazy(() => import('../pages/dashboard/CommunicationsHubPage').then((m) => ({ default: m.CommunicationsHubPage })))
const LibraryOpsPage = lazy(() => import('../pages/dashboard/LibraryOpsPage').then((m) => ({ default: m.LibraryOpsPage })))
const ClinicOpsPage = lazy(() => import('../pages/dashboard/ClinicOpsPage').then((m) => ({ default: m.ClinicOpsPage })))
const BoardingOpsPage = lazy(() => import('../pages/dashboard/BoardingOpsPage').then((m) => ({ default: m.BoardingOpsPage })))
const TransportOpsPage = lazy(() => import('../pages/dashboard/TransportOpsPage').then((m) => ({ default: m.TransportOpsPage })))
const SaasOverviewPage = lazy(() => import('../pages/dashboard/SaasOverviewPage').then((m) => ({ default: m.SaasOverviewPage })))
const ParentPortalPage = lazy(() => import('../pages/portal/ParentPortalPage').then((m) => ({ default: m.ParentPortalPage })))

export function ErpSiteRoutes() {
  const kind = getSiteKind()
  const devParentShell = kind === 'dev'

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth/login" replace />} />
      {kind === 'app' ? <Route path="/portal/*" element={<RedirectToPortalOrigin />} /> : null}
      <Route element={<PublicRoute />}>
        <Route path="/auth" element={<AuthLayout variant="erp" />}>
          <Route index element={<Navigate to="/auth/login" replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>
        <Route path="/kiosk/staff" element={<StaffQrKioskPage />} />
      </Route>
      <Route element={<ProtectedRoute denyRoles={['parent']} />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/search" element={<SearchPage />} />
          <Route path="/dashboard/students" element={<StudentsPage />} />
          <Route path="/dashboard/students/:studentId" element={<StudentProfilePage />} />
          <Route path="/dashboard/attendance" element={<AttendancePage />} />
          <Route path="/dashboard/attendance/register" element={<ClassAttendanceRegisterPage />} />
          <Route path="/dashboard/attendance/staff-qr" element={<StaffQrManagementPage />} />
          <Route element={<ProtectedRoute requiredPermissions={['academics.enter_marks']} />}>
            <Route path="/dashboard/academics" element={<AcademicsPage />} />
          </Route>
          <Route path="/dashboard/fees" element={<FeesPage />} />
          <Route element={<ProtectedRoute requiredPermissions={['finance.post_journal']} />}>
            <Route path="/dashboard/finance" element={<FinancePage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermissions={['finance.reconcile']} />}>
            <Route path="/dashboard/finance-ops" element={<FinanceOpsPage />} />
            <Route path="/dashboard/finance/reconciliation-center" element={<ReconciliationCenterPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['super_admin', 'school_director', 'head_teacher', 'bursar', 'accountant']} />}>
            <Route path="/dashboard/ops/communications" element={<CommunicationsHubPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermissions={['library.manage']} />}>
            <Route path="/dashboard/ops/library" element={<LibraryOpsPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermissions={['health.manage']} />}>
            <Route path="/dashboard/ops/clinic" element={<ClinicOpsPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermissions={['boarding.manage']} />}>
            <Route path="/dashboard/ops/boarding" element={<BoardingOpsPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermissions={['transport.manage']} />}>
            <Route path="/dashboard/ops/transport" element={<TransportOpsPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['super_admin', 'school_director', 'registrar', 'accountant', 'bursar']} />}>
            <Route path="/dashboard/admin-ops" element={<AdminOpsPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermissions={['admin.approvals.review']} />}>
            <Route path="/dashboard/approvals" element={<ApprovalsPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermissions={['ops.archive.manage', 'ops.backup.manage']} />}>
            <Route path="/dashboard/reliability" element={<ReliabilityPage />} />
            <Route path="/dashboard/ops/jobs" element={<JobsQueuePage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
            <Route path="/dashboard/saas" element={<SaasOverviewPage />} />
          </Route>
        </Route>
      </Route>
      {devParentShell ? (
        <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
          <Route element={<ParentShell />}>
            <Route path="/portal" element={<ParentPortalPage />} />
            <Route path="/portal/student/:studentId" element={<StudentProfilePage />} />
          </Route>
        </Route>
      ) : null}
    </Routes>
  )
}
