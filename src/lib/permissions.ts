import type { Role } from '../types'

const matrix: Record<Role, string[]> = {
  super_admin: ['*'],
  school_director: ['dashboard:view', 'students:manage', 'fees:manage', 'reports:view', 'admin.approvals.review', 'ops.archive.manage', 'ops.backup.manage'],
  registrar: ['dashboard:view', 'students:manage', 'reports:view'],
  head_teacher: ['dashboard:view', 'students:manage', 'attendance:manage', 'academics:manage', 'academics.enter_marks'],
  bursar: ['dashboard:view', 'fees:manage', 'invoices:manage', 'reports:view', 'finance.reconcile', 'finance.cashier.close'],
  accountant: ['dashboard:view', 'fees:manage', 'payroll:manage', 'reports:view', 'finance.post_journal', 'finance.reconcile', 'finance.cashier.close'],
  hr_manager: ['dashboard:view', 'staff:manage', 'payroll:manage'],
  teacher: ['dashboard:view', 'attendance:manage', 'academics:manage'],
  parent: ['portal:view', 'fees:view', 'payments:create', 'attendance:view'],
  student: ['portal:view', 'academics:view', 'attendance:view'],
  store_manager: ['dashboard:view', 'inventory:manage'],
  transport_manager: ['dashboard:view', 'transport:manage'],
  driver: ['dashboard:view', 'transport:view'],
  boarding_admin: ['dashboard:view', 'boarding:manage'],
  nurse: ['dashboard:view', 'health:manage'],
  librarian: ['dashboard:view', 'library:manage'],
}

export function can(role: Role, permission: string) {
  const allowed = matrix[role] ?? []
  return allowed.includes('*') || allowed.includes(permission)
}

