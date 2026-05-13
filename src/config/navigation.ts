import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BookOpenCheck,
  CalendarCheck2,
  GraduationCap,
  HandCoins,
  LayoutDashboard,
  QrCode,
  Radio,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import type { Role } from '../types'

export type ShellNavLink = {
  to: string
  label: string
  icon: LucideIcon
  /** If set, user must have one of these roles (or be super_admin). */
  roles?: Role[]
  /** If set, user must have at least one permission (or be super_admin). */
  anyPermissions?: string[]
  /** Hide from these roles (applied after other checks). */
  excludeRoles?: Role[]
}

export type ShellNavSection = {
  section: string
  links: ShellNavLink[]
}

export const ALL_NAV_SECTIONS: ShellNavSection[] = [
  {
    section: 'Operations',
    links: [
      { to: '/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
      { to: '/dashboard/search', label: 'ERP search', icon: Search, excludeRoles: ['driver', 'student'] },
      { to: '/dashboard/students', label: 'Student Registry', icon: GraduationCap, excludeRoles: ['driver'] },
      { to: '/dashboard/attendance', label: 'Attendance Control', icon: CalendarCheck2 },
      { to: '/dashboard/attendance/register', label: 'Class register', icon: CalendarCheck2 },
      { to: '/dashboard/attendance/staff-qr', label: 'Staff QR IDs', icon: QrCode, excludeRoles: ['student'] },
    ],
  },
  {
    section: 'Academics',
    links: [{ to: '/dashboard/academics', label: 'Academics & Marks', icon: BookOpenCheck, anyPermissions: ['academics.enter_marks'] }],
  },
  {
    section: 'Finance',
    links: [
      { to: '/dashboard/fees', label: 'Billing & Collections', icon: Wallet, excludeRoles: ['teacher', 'librarian', 'nurse', 'driver'] },
      { to: '/dashboard/finance', label: 'Ledger & Journals', icon: HandCoins, anyPermissions: ['finance.post_journal'] },
      { to: '/dashboard/finance-ops', label: 'Reconciliation & Cashier', icon: Scale, anyPermissions: ['finance.reconcile'] },
      { to: '/dashboard/finance/reconciliation-center', label: 'MoMo reconciliation center', icon: Radio, anyPermissions: ['finance.reconcile'] },
    ],
  },
  {
    section: 'Departments',
    links: [
      { to: '/dashboard/ops/library', label: 'Library & loans', icon: BookOpenCheck, anyPermissions: ['library.manage'] },
      { to: '/dashboard/ops/clinic', label: 'Clinic & health', icon: Activity, anyPermissions: ['health.manage'] },
      { to: '/dashboard/ops/boarding', label: 'Boarding & dorms', icon: LayoutDashboard, anyPermissions: ['boarding.manage'] },
      { to: '/dashboard/ops/transport', label: 'Transport & routes', icon: CalendarCheck2, anyPermissions: ['transport.manage'] },
      { to: '/dashboard/ops/communications', label: 'SMS / WhatsApp hub', icon: Radio, roles: ['super_admin', 'school_director', 'head_teacher', 'bursar', 'accountant'] },
    ],
  },
  {
    section: 'Administration',
    links: [
      { to: '/dashboard/admin-ops', label: 'Admin Ops & Audit', icon: Settings2, roles: ['super_admin', 'school_director', 'registrar', 'accountant', 'bursar'] },
      { to: '/dashboard/approvals', label: 'Approvals', icon: ShieldCheck, anyPermissions: ['admin.approvals.review'] },
      { to: '/dashboard/reliability', label: 'Reliability & Recovery', icon: ShieldCheck, anyPermissions: ['ops.archive.manage', 'ops.backup.manage'] },
      { to: '/dashboard/ops/jobs', label: 'Job queue & DLQ', icon: Activity, anyPermissions: ['ops.archive.manage', 'ops.backup.manage'] },
      { to: '/dashboard/saas', label: 'SaaS & schools', icon: ShieldCheck, roles: ['super_admin'] },
    ],
  },
]

function isSuper(role: Role | undefined) {
  return role === 'super_admin'
}

export function filterNavSections(profile: { role: Role } | null, permissions: string[]): ShellNavSection[] {
  if (!profile) return []
  const role = profile.role
  const hasPerm = (codes: string[]) => codes.some((c) => permissions.includes(c))

  return ALL_NAV_SECTIONS.map((sec) => ({
    section: sec.section,
    links: sec.links.filter((link) => {
      if (link.excludeRoles?.includes(role)) return false
      if (isSuper(role)) return true
      if (link.roles?.length) {
        return link.roles.includes(role)
      }
      if (link.anyPermissions?.length) {
        return hasPerm(link.anyPermissions)
      }
      return true
    }),
  })).filter((s) => s.links.length > 0)
}
