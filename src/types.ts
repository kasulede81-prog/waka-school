export type Role =
  | 'super_admin'
  | 'school_director'
  | 'registrar'
  | 'head_teacher'
  | 'bursar'
  | 'accountant'
  | 'hr_manager'
  | 'teacher'
  | 'parent'
  | 'student'
  | 'store_manager'
  | 'transport_manager'
  | 'driver'
  | 'boarding_admin'
  | 'nurse'
  | 'librarian'

export interface SessionUser {
  id: string
  organizationId: string | null
  fullName: string
  phone: string
  email: string
  role: Role
}

export interface DashboardMetric {
  title: string
  value: string
  delta?: string
}

export interface Student {
  id: string
  fullName: string
  admissionNumber: string
  className: string
  stream: string
  status: 'active' | 'inactive' | 'graduated' | 'suspended'
  parentPhone: string
}

export interface AuditEvent {
  id: string
  action: string
  created_at: string
  metadata: Record<string, unknown>
}

export interface FeeBalance {
  invoiceId?: string
  studentId?: string
  studentName: string
  balance: number
  paid: number
  dueDate: string
}

