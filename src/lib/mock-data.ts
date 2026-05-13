import type { DashboardMetric, FeeBalance, SessionUser, Student } from '../types'

export const demoUser: SessionUser = {
  id: 'u_001',
  organizationId: 'org_st_mary',
  fullName: 'Grace Nambatya',
  phone: '+256772000111',
  email: 'grace@wakaschool.app',
  role: 'school_director',
}

export const dashboardMetrics: DashboardMetric[] = [
  { title: 'Active Students', value: '1,248', delta: '+6.4%' },
  { title: 'Fees Collected (UGX)', value: '62,450,000', delta: '+12.1%' },
  { title: 'Outstanding Balance', value: '18,930,000', delta: '-4.2%' },
  { title: 'Attendance Today', value: '94.8%', delta: '+1.3%' },
]

export const students: Student[] = [
  {
    id: 's1',
    fullName: 'Aisha Nakato',
    admissionNumber: 'WAKA-2026-0012',
    className: 'P6',
    stream: 'Blue',
    status: 'active',
    parentPhone: '+256700100222',
  },
  {
    id: 's2',
    fullName: 'Daniel Ocen',
    admissionNumber: 'WAKA-2025-0391',
    className: 'S2',
    stream: 'East',
    status: 'active',
    parentPhone: '+256781223344',
  },
  {
    id: 's3',
    fullName: 'Mercy Aciro',
    admissionNumber: 'WAKA-2024-0101',
    className: 'S4',
    stream: 'North',
    status: 'inactive',
    parentPhone: '+256756332211',
  },
]

export const balances: FeeBalance[] = [
  { studentName: 'Aisha Nakato', balance: 420000, paid: 980000, dueDate: '2026-06-03' },
  { studentName: 'Daniel Ocen', balance: 1650000, paid: 350000, dueDate: '2026-05-28' },
  { studentName: 'Mercy Aciro', balance: 800000, paid: 600000, dueDate: '2026-05-21' },
]

