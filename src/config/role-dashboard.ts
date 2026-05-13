import type { Role } from '../types'

export type DashboardTask = { label: string; href: string; tone?: 'urgent' | 'default' }
export type DashboardKpiHint = { label: string; valueKey: 'students' | 'fees' | 'outstanding' | 'attendance' }

export type RoleDashboardBlueprint = {
  headline: string
  subline: string
  kpis: DashboardKpiHint[]
  tasks: DashboardTask[]
  modules: string[]
}

const financeKpis: DashboardKpiHint[] = [
  { label: 'Active students', valueKey: 'students' },
  { label: 'Fees collected', valueKey: 'fees' },
  { label: 'Outstanding', valueKey: 'outstanding' },
  { label: 'Attendance today', valueKey: 'attendance' },
]

export const ROLE_DASHBOARD: Partial<Record<Role, RoleDashboardBlueprint>> & { default: RoleDashboardBlueprint } = {
  default: {
    headline: 'School overview',
    subline: 'Cross-functional KPIs for your assigned permissions.',
    kpis: financeKpis,
    tasks: [
      { label: 'Review pending approvals', href: '/dashboard/approvals', tone: 'urgent' },
      { label: 'Open class attendance register', href: '/dashboard/attendance/register' },
    ],
    modules: ['Students', 'Attendance', 'Finance'],
  },
  super_admin: {
    headline: 'Platform operations',
    subline: 'Multi-tenant health, subscriptions, and escalations across all schools.',
    kpis: financeKpis,
    tasks: [
      { label: 'SaaS & subscription posture', href: '/dashboard/saas', tone: 'urgent' },
      { label: 'Reliability & job queue', href: '/dashboard/reliability' },
      { label: 'MoMo reconciliation center', href: '/dashboard/finance/reconciliation-center' },
    ],
    modules: ['SaaS', 'Reliability', 'Reconciliation', 'Audit'],
  },
  school_director: {
    headline: 'Director command center',
    subline: 'Institutional performance, compliance, and finance risk in one glance.',
    kpis: financeKpis,
    tasks: [
      { label: 'Approvals & policy exceptions', href: '/dashboard/approvals', tone: 'urgent' },
      { label: 'Executive audit trail', href: '/dashboard/admin-ops' },
      { label: 'Communications hub', href: '/dashboard/ops/communications' },
    ],
    modules: ['Strategy', 'Finance', 'Academics', 'Compliance'],
  },
  registrar: {
    headline: 'Registrar desk',
    subline: 'Admissions integrity, class placement, and academic records.',
    kpis: financeKpis,
    tasks: [
      { label: 'Maintain student registry', href: '/dashboard/students' },
      { label: 'Marks & transcripts', href: '/dashboard/academics' },
      { label: 'Attendance quality', href: '/dashboard/attendance' },
    ],
    modules: ['Registry', 'Academics', 'Attendance'],
  },
  bursar: {
    headline: 'Bursar control tower',
    subline: 'Collections, waivers, mobile money, and ledger discipline.',
    kpis: financeKpis,
    tasks: [
      { label: 'MoMo reconciliation center', href: '/dashboard/finance/reconciliation-center', tone: 'urgent' },
      { label: 'Cashier & bank reconciliation', href: '/dashboard/finance-ops' },
      { label: 'Billing templates', href: '/dashboard/fees' },
    ],
    modules: ['Billing', 'Ledger', 'Reconciliation', 'Cashier'],
  },
  accountant: {
    headline: 'Accountant workspace',
    subline: 'Journals, adjustments, and audit-ready exports.',
    kpis: financeKpis,
    tasks: [
      { label: 'Ledger & journals', href: '/dashboard/finance' },
      { label: 'Reconciliation center', href: '/dashboard/finance/reconciliation-center' },
      { label: 'Finance approvals', href: '/dashboard/approvals' },
    ],
    modules: ['Ledger', 'Reconciliation', 'Approvals'],
  },
  teacher: {
    headline: 'Teacher workspace',
    subline: 'Classroom attendance, marks entry, and learner progress.',
    kpis: [
      { label: 'Active students', valueKey: 'students' },
      { label: 'Attendance today', valueKey: 'attendance' },
    ],
    tasks: [
      { label: 'Class register', href: '/dashboard/attendance/register', tone: 'urgent' },
      { label: 'Marks & assessments', href: '/dashboard/academics' },
    ],
    modules: ['Attendance', 'Academics'],
  },
  head_teacher: {
    headline: 'Head teacher oversight',
    subline: 'Day-to-day academic conduct and staff attendance alignment.',
    kpis: financeKpis,
    tasks: [
      { label: 'Attendance analytics', href: '/dashboard/attendance' },
      { label: 'Staff QR programme', href: '/dashboard/attendance/staff-qr' },
      { label: 'Academic insights', href: '/dashboard/academics' },
    ],
    modules: ['Attendance', 'Academics', 'Staffing'],
  },
  librarian: {
    headline: 'Library operations',
    subline: 'Loans, returns, and inventory risk.',
    kpis: [{ label: 'Active students', valueKey: 'students' }],
    tasks: [{ label: 'Open library console', href: '/dashboard/ops/library', tone: 'urgent' }],
    modules: ['Circulation', 'Catalog'],
  },
  nurse: {
    headline: 'Clinic & wellness',
    subline: 'Visits, medications, and escalation readiness.',
    kpis: [{ label: 'Active students', valueKey: 'students' }],
    tasks: [{ label: 'Clinic visits', href: '/dashboard/ops/clinic', tone: 'urgent' }],
    modules: ['Triage', 'Medical records'],
  },
  boarding_admin: {
    headline: 'Boarding master desk',
    subline: 'Occupancy, bed allocation, and pastoral incidents.',
    kpis: [{ label: 'Active students', valueKey: 'students' }],
    tasks: [{ label: 'Dormitory roster', href: '/dashboard/ops/boarding', tone: 'urgent' }],
    modules: ['Dorms', 'Occupancy'],
  },
  transport_manager: {
    headline: 'Transport command',
    subline: 'Routes, drivers, and learner movement safety.',
    kpis: [{ label: 'Active students', valueKey: 'students' }],
    tasks: [{ label: 'Routes & assignments', href: '/dashboard/ops/transport', tone: 'urgent' }],
    modules: ['Routes', 'Fleet'],
  },
  parent: {
    headline: 'Parent portal',
    subline: 'Linked learners, balances, and announcements.',
    kpis: [],
    tasks: [{ label: 'Open parent portal', href: '/portal' }],
    modules: ['Children', 'Payments', 'Announcements'],
  },
  student: {
    headline: 'Student workspace',
    subline: 'Personal timetable, marks, and attendance (read-only where configured).',
    kpis: [
      { label: 'Attendance today', valueKey: 'attendance' },
    ],
    tasks: [
      { label: 'Attendance history', href: '/dashboard/attendance' },
    ],
    modules: ['Attendance'],
  },
}

export function getRoleDashboard(role: Role | undefined): RoleDashboardBlueprint {
  if (!role) return ROLE_DASHBOARD.default
  return ROLE_DASHBOARD[role] ?? ROLE_DASHBOARD.default
}
