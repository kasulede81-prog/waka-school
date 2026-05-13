import { supabase, isSupabaseConfigured } from './supabase'

function requireConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
}

type DbStudent = {
  id: string
  full_name: string
  admission_number: string
  class_name: string
  stream: string | null
  status: 'active' | 'inactive' | 'graduated' | 'suspended'
  parent_phone: string | null
}

export async function listStudents(organizationId?: string | null, opts?: { search?: string; limit?: number }) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')

  let q = supabase
    .from('students')
    .select('id, full_name, admission_number, class_name, stream, status, parent_phone')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  const term = opts?.search?.trim()
  if (term) {
    const safe = term.replace(/[^a-zA-Z0-9\s\-]/g, '').slice(0, 80)
    if (safe.length) {
      const like = `%${safe}%`
      q = q.or(`full_name.ilike.${like},admission_number.ilike.${like},class_name.ilike.${like}`)
    }
  }
  if (opts?.limit) {
    q = q.limit(opts.limit)
  }

  const { data, error } = await q

  if (error) throw error

  return (data as DbStudent[]).map((s) => ({
    id: s.id,
    fullName: s.full_name,
    admissionNumber: s.admission_number,
    className: s.class_name,
    stream: s.stream ?? '-',
    status: s.status,
    parentPhone: s.parent_phone ?? '-',
  }))
}

export async function updateStudent(payload: {
  organizationId: string
  studentId: string
  fullName: string
  className: string
  stream: string
  parentPhone: string
  status: 'active' | 'inactive' | 'graduated' | 'suspended'
}) {
  requireConfigured()
  const { error } = await supabase
    .from('students')
    .update({
      full_name: payload.fullName,
      class_name: payload.className,
      stream: payload.stream,
      parent_phone: payload.parentPhone,
      status: payload.status,
    })
    .eq('organization_id', payload.organizationId)
    .eq('id', payload.studentId)
  if (error) throw error
}

export async function deleteStudent(organizationId: string, studentId: string) {
  requireConfigured()
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', studentId)
  if (error) throw error
}

export async function createStudent(payload: {
  organizationId: string
  fullName: string
  admissionNumber: string
  className: string
  stream: string
  parentPhone: string
  gender?: string
}) {
  requireConfigured()
  const { error } = await supabase.from('students').insert({
    organization_id: payload.organizationId,
    full_name: payload.fullName,
    admission_number: payload.admissionNumber,
    class_name: payload.className,
    stream: payload.stream,
    parent_phone: payload.parentPhone,
    gender: payload.gender ?? 'other',
  })
  if (error) throw error
}

export async function bulkUpdateStudentStatus(payload: {
  organizationId: string
  studentIds: string[]
  status: 'active' | 'inactive' | 'graduated' | 'suspended'
}) {
  requireConfigured()
  if (!payload.studentIds.length) return
  const { error } = await supabase
    .from('students')
    .update({ status: payload.status })
    .eq('organization_id', payload.organizationId)
    .in('id', payload.studentIds)
  if (error) throw error
}

type FeeRow = {
  id: string
  student_id: string
  due_date: string | null
  amount_paid: number
  balance: number
  students: { full_name: string }[] | null
}

export async function listInvoiceBalances(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')

  const { data, error } = await supabase
    .from('invoices')
    .select('id, student_id, due_date, amount_paid, balance, students(full_name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data as FeeRow[]).map((row) => ({
    invoiceId: row.id,
    studentId: row.student_id,
    studentName: row.students?.[0]?.full_name ?? 'Unknown Student',
    balance: Number(row.balance ?? 0),
    paid: Number(row.amount_paid ?? 0),
    dueDate: row.due_date ?? 'N/A',
  }))
}

export async function listFeeStructures(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('fees')
    .select('id, category, amount, academic_year, term')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createFeeStructure(payload: {
  organizationId: string
  category: string
  amount: number
  academicYear: string
  term: string
}) {
  requireConfigured()
  const { error } = await supabase.from('fees').insert({
    organization_id: payload.organizationId,
    category: payload.category,
    amount: payload.amount,
    academic_year: payload.academicYear,
    term: payload.term,
  })
  if (error) throw error
}

export async function generateInvoicesFromFeeStructures(payload: {
  organizationId: string
  dueDate: string
  academicYear: string
  term: string
}) {
  requireConfigured()
  const [feesRes, studentsRes] = await Promise.all([
    supabase
      .from('fees')
      .select('amount')
      .eq('organization_id', payload.organizationId)
      .eq('academic_year', payload.academicYear)
      .eq('term', payload.term),
    supabase.from('students').select('id').eq('organization_id', payload.organizationId).eq('status', 'active'),
  ])
  if (feesRes.error) throw feesRes.error
  if (studentsRes.error) throw studentsRes.error
  const total = (feesRes.data ?? []).reduce((acc, f) => acc + Number(f.amount ?? 0), 0)
  if (total <= 0) throw new Error('No fee structures found for selected term.')
  const invoices = (studentsRes.data ?? []).map((s) => ({
    organization_id: payload.organizationId,
    student_id: s.id,
    total_amount: total,
    amount_paid: 0,
    due_date: payload.dueDate,
    status: 'pending',
  }))
  if (!invoices.length) throw new Error('No active students to invoice.')
  const { error } = await supabase.from('invoices').insert(invoices)
  if (error) throw error
}

export async function getFinanceSummary(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const [invoiceRes, paymentRes] = await Promise.all([
    supabase.from('invoices').select('total_amount, amount_paid, balance, status').eq('organization_id', organizationId),
    supabase.from('payments').select('amount, status, method').eq('organization_id', organizationId),
  ])
  if (invoiceRes.error) throw invoiceRes.error
  if (paymentRes.error) throw paymentRes.error
  const invoices = invoiceRes.data ?? []
  const payments = paymentRes.data ?? []
  return {
    invoiced: invoices.reduce((a, i) => a + Number(i.total_amount ?? 0), 0),
    paid: invoices.reduce((a, i) => a + Number(i.amount_paid ?? 0), 0),
    outstanding: invoices.reduce((a, i) => a + Number(i.balance ?? 0), 0),
    paidInvoices: invoices.filter((i) => i.status === 'paid').length,
    pendingInvoices: invoices.filter((i) => i.status !== 'paid').length,
    successfulPayments: payments.filter((p) => p.status === 'successful').length,
  }
}

export async function recordPayment(payload: {
  organizationId: string
  invoiceId: string
  studentId: string
  amount: number
  method: 'mtn_momo' | 'airtel_money' | 'cash' | 'bank_transfer' | 'easypay'
  phoneNumber?: string
}) {
  requireConfigured()
  const { error } = await supabase.from('payments').insert({
    organization_id: payload.organizationId,
    invoice_id: payload.invoiceId,
    student_id: payload.studentId,
    amount: payload.amount,
    method: payload.method,
    status: payload.method === 'cash' ? 'successful' : 'pending',
    phone_number: payload.phoneNumber,
  })
  if (error) throw error
}

export type StudentAttendanceStatus = 'present' | 'absent' | 'late' | 'sick' | 'excused'

type AttendanceRow = {
  id: string
  attendance_date: string
  status: StudentAttendanceStatus
  notes: string | null
  students: { full_name: string }[] | null
}

export async function listAttendance(
  organizationId?: string | null,
): Promise<Array<{ id: string; studentName: string; date: string; status: StudentAttendanceStatus; notes: string }>> {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')

  const { data, error } = await supabase
    .from('attendance')
    .select('id, attendance_date, status, notes, students(full_name)')
    .eq('organization_id', organizationId)
    .order('attendance_date', { ascending: false })
    .limit(100)
  if (error) throw error

  return (data as AttendanceRow[]).map((row) => ({
    id: row.id,
    studentName: row.students?.[0]?.full_name ?? 'Unknown Student',
    date: row.attendance_date,
    status: row.status as StudentAttendanceStatus,
    notes: row.notes ?? '',
  }))
}

export async function createAttendance(payload: {
  organizationId: string
  studentId: string
  date: string
  status: StudentAttendanceStatus
  notes?: string
}) {
  requireConfigured()
  const { error } = await supabase.from('attendance').insert({
    organization_id: payload.organizationId,
    student_id: payload.studentId,
    attendance_date: payload.date,
    status: payload.status,
    notes: payload.notes ?? '',
  })
  if (error) throw error
}

export async function getAttendanceAnalytics(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceDate = since.toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('attendance')
    .select('attendance_date, status, students(full_name, parent_phone)')
    .eq('organization_id', organizationId)
    .gte('attendance_date', sinceDate)
  if (error) throw error
  const rows = (data ?? []) as Array<{
    attendance_date: string
    status: StudentAttendanceStatus
    students: { full_name: string; parent_phone: string }[]
  }>
  const total = rows.length
  const present = rows.filter((r) => r.status === 'present').length
  const absent = rows.filter((r) => r.status === 'absent').length
  const late = rows.filter((r) => r.status === 'late').length
  const sick = rows.filter((r) => r.status === 'sick').length
  const excused = rows.filter((r) => r.status === 'excused').length
  const absenteeSmsList = rows
    .filter((r) => r.status === 'absent')
    .map((r) => ({
      studentName: r.students?.[0]?.full_name ?? 'Unknown',
      parentPhone: r.students?.[0]?.parent_phone ?? '',
      date: r.attendance_date,
    }))
  return {
    total,
    present,
    absent,
    late,
    sick,
    excused,
    attendanceRate: total ? (present / total) * 100 : 0,
    absenteeSmsList,
  }
}

export async function listTeachers(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('teachers')
    .select('id, full_name')
    .eq('organization_id', organizationId)
    .order('full_name')
  if (error) throw error
  return data ?? []
}

export async function listTeacherAttendance(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('teacher_attendance')
    .select('id, attendance_date, status, notes, teachers(full_name)')
    .eq('organization_id', organizationId)
    .order('attendance_date', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    attendance_date: string
    status: 'present' | 'absent' | 'late'
    notes: string
    teachers: { full_name: string }[]
  }>
}

export async function createTeacherAttendance(payload: {
  organizationId: string
  teacherId: string
  date: string
  status: 'present' | 'absent' | 'late'
  notes?: string
}) {
  requireConfigured()
  const { error } = await supabase.from('teacher_attendance').insert({
    organization_id: payload.organizationId,
    teacher_id: payload.teacherId,
    attendance_date: payload.date,
    status: payload.status,
    notes: payload.notes ?? '',
    check_source: 'manual',
  })
  if (error) throw error
}

export async function sendAttendanceAlert(payload: {
  organizationId: string
  title: string
  body: string
}) {
  requireConfigured()
  const { error } = await supabase.functions.invoke('send-notification', {
    body: {
      organizationId: payload.organizationId,
      channel: 'sms',
      title: payload.title,
      body: payload.body,
    },
  })
  if (error) throw error
}

export async function listCampuses(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('campuses')
    .select('id, name, code, is_main')
    .eq('organization_id', organizationId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function listTeachersWithQrTokens(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const [teachersRes, qrRes] = await Promise.all([
    supabase.from('teachers').select('id, full_name').eq('organization_id', organizationId).order('full_name'),
    supabase.from('teacher_attendance_qr').select('teacher_id, secret_token').eq('organization_id', organizationId),
  ])
  if (teachersRes.error) throw teachersRes.error
  if (qrRes.error) throw qrRes.error
  const byTeacher = new Map((qrRes.data ?? []).map((r) => [(r as { teacher_id: string }).teacher_id, (r as { secret_token: string }).secret_token]))
  return (teachersRes.data ?? []).map((t) => ({
    id: t.id,
    full_name: t.full_name as string,
    secret_token: byTeacher.get(t.id) ?? '',
  }))
}

export async function rotateTeacherQrToken(teacherId: string) {
  requireConfigured()
  const { data, error } = await supabase.rpc('rotate_teacher_attendance_qr', { p_teacher_id: teacherId })
  if (error) throw error
  return data as string
}

export async function recordStaffQrCheckIn(payload: { secret: string; campusId: string | null; device: string }) {
  requireConfigured()
  const { data, error } = await supabase.rpc('record_staff_qr_check_in', {
    p_secret: payload.secret,
    p_campus_id: payload.campusId,
    p_device: payload.device,
  })
  if (error) throw error
  return data as Record<string, unknown>
}

export async function getStaffQrKioskContext(secret: string) {
  requireConfigured()
  const { data, error } = await supabase.rpc('get_staff_qr_kiosk_context', { p_secret: secret })
  if (error) throw error
  return data as Record<string, unknown>
}

export async function createAttendanceSession(payload: {
  organizationId: string
  className: string
  stream: string
  sessionDate: string
  openedBy: string
  expiresAt?: string | null
}) {
  requireConfigured()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert({
      organization_id: payload.organizationId,
      class_name: payload.className,
      stream: payload.stream || null,
      session_date: payload.sessionDate,
      opened_by: payload.openedBy,
      expires_at: payload.expiresAt ?? null,
    })
    .select('id, public_token, session_date, class_name, stream')
    .single()
  if (error) throw error
  return data as {
    id: string
    public_token: string
    session_date: string
    class_name: string
    stream: string | null
  }
}

export async function resolveAttendanceSessionToken(token: string) {
  requireConfigured()
  const { data, error } = await supabase.rpc('resolve_attendance_session_token', { p_token: token })
  if (error) throw error
  return data as Record<string, unknown>
}

export async function saveClassAttendanceRegister(sessionId: string, entries: Array<{ student_id: string; status: StudentAttendanceStatus; notes?: string }>) {
  requireConfigured()
  const { data, error } = await supabase.rpc('save_class_attendance_register', {
    p_session_id: sessionId,
    p_entries: entries,
  })
  if (error) throw error
  return data as Record<string, unknown>
}

export async function listStudentsInClass(
  organizationId: string,
  className: string,
  stream: string | null | undefined,
) {
  requireConfigured()
  let q = supabase
    .from('students')
    .select('id, full_name, admission_number, class_name, stream')
    .eq('organization_id', organizationId)
    .eq('class_name', className)
    .eq('status', 'active')
    .order('full_name')
  if (stream && stream !== '—' && stream !== '-') {
    q = q.eq('stream', stream)
  }
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function listDistinctClassNames(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase.from('students').select('class_name, stream').eq('organization_id', organizationId)
  if (error) throw error
  const map = new Map<string, Set<string>>()
  for (const row of data ?? []) {
    const r = row as { class_name: string; stream: string | null }
    if (!map.has(r.class_name)) map.set(r.class_name, new Set())
    if (r.stream) map.get(r.class_name)!.add(r.stream)
  }
  return Array.from(map.entries()).map(([className, streams]) => ({
    className,
    streams: Array.from(streams.values()).sort(),
  }))
}

export type FeeChargeLineRow = {
  id: string
  fee_category: string
  academic_year: string
  term: string
  amount_billed: number
  amount_paid: number
  balance: number
  due_date: string | null
}

export async function listFeeChargeLinesForStudent(studentId: string) {
  requireConfigured()
  const { data, error } = await supabase
    .from('fee_charge_lines')
    .select('id, fee_category, academic_year, term, amount_billed, amount_paid, balance, due_date')
    .eq('student_id', studentId)
    .order('due_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as FeeChargeLineRow[]
}

export async function createFeeChargeLine(payload: {
  organizationId: string
  studentId: string
  feeCategory: string
  academicYear: string
  term: string
  amountBilled: number
  dueDate?: string | null
}) {
  requireConfigured()
  const { error } = await supabase.from('fee_charge_lines').insert({
    organization_id: payload.organizationId,
    student_id: payload.studentId,
    fee_category: payload.feeCategory,
    academic_year: payload.academicYear,
    term: payload.term,
    amount_billed: payload.amountBilled,
    amount_paid: 0,
    due_date: payload.dueDate ?? null,
  })
  if (error) throw error
}

export async function getStudentRecord(studentId: string) {
  requireConfigured()
  const { data, error } = await supabase
    .from('students')
    .select(
      'id, organization_id, full_name, admission_number, class_name, stream, status, parent_phone, parent_email, address, medical_notes, date_of_birth, gender',
    )
    .eq('id', studentId)
    .single()
  if (error) throw error
  return data as {
    id: string
    organization_id: string
    full_name: string
    admission_number: string
    class_name: string
    stream: string | null
    status: string
    parent_phone: string | null
    parent_email: string | null
    address: string | null
    medical_notes: string | null
    date_of_birth: string | null
    gender: string
  }
}

export async function listStudentAttendanceRecent(studentId: string, limit = 60) {
  requireConfigured()
  const { data, error } = await supabase
    .from('attendance')
    .select('attendance_date, status, notes')
    .eq('student_id', studentId)
    .order('attendance_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Array<{ attendance_date: string; status: StudentAttendanceStatus; notes: string | null }>
}

export async function listStudentReportCards(studentId: string) {
  requireConfigured()
  const { data, error } = await supabase
    .from('report_cards')
    .select('exam_name, academic_year, term, aggregate, division, total_marks, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listStudentMarks(studentId: string) {
  requireConfigured()
  const { data, error } = await supabase
    .from('marks')
    .select('score, max_score, grade, subjects(name), exams(name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(80)
  if (error) throw error
  return (data ?? []) as Array<{
    score: number
    max_score: number
    grade: string | null
    subjects: { name: string }[] | null
    exams: { name: string }[] | null
  }>
}

export async function listStudentInvoices(studentId: string) {
  requireConfigured()
  const { data, error } = await supabase
    .from('invoices')
    .select('id, total_amount, amount_paid, balance, due_date, status, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listAnnouncements(organizationId?: string | null, limit = 20) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, channel, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function initiateMobileMoneyPayment(payload: {
  organizationId: string
  invoiceId: string
  studentId: string
  phoneNumber: string
  amount: number
  provider: 'mtn_momo' | 'airtel_money'
}) {
  requireConfigured()
  const { data, error } = await supabase.functions.invoke('initiate-mobile-money', {
    body: payload,
  })
  if (error) throw error
  return data
}

export async function getDashboardSummary(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')

  const [studentsCount, invoiceAgg, attendanceAgg] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('invoices').select('balance, amount_paid').eq('organization_id', organizationId),
    supabase.from('attendance').select('status').eq('organization_id', organizationId).eq('attendance_date', new Date().toISOString().slice(0, 10)),
  ])

  if (studentsCount.error) throw studentsCount.error
  if (invoiceAgg.error) throw invoiceAgg.error
  if (attendanceAgg.error) throw attendanceAgg.error

  const invoices = invoiceAgg.data ?? []
  const totalPaid = invoices.reduce((acc, row) => acc + Number(row.amount_paid ?? 0), 0)
  const outstanding = invoices.reduce((acc, row) => acc + Number(row.balance ?? 0), 0)
  const attendanceRows = attendanceAgg.data ?? []
  const present = attendanceRows.filter((a) => a.status === 'present').length
  const attendancePct = attendanceRows.length ? (present / attendanceRows.length) * 100 : 0

  return {
    activeStudents: studentsCount.count ?? 0,
    feesCollected: totalPaid,
    outstandingBalance: outstanding,
    attendanceToday: attendancePct,
  }
}

type MarkRow = {
  id: string
  score: number
  max_score: number
  grade: string | null
  students: { full_name: string }[] | null
  subjects: { name: string }[] | null
  exams: { name: string }[] | null
}

export async function listMarks(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')

  const { data, error } = await supabase
    .from('marks')
    .select('id, score, max_score, grade, students(full_name), subjects(name), exams(name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data as MarkRow[]).map((row) => ({
    id: row.id,
    studentName: row.students?.[0]?.full_name ?? 'Unknown',
    subjectName: row.subjects?.[0]?.name ?? 'Subject',
    examName: row.exams?.[0]?.name ?? 'Exam',
    score: Number(row.score),
    maxScore: Number(row.max_score),
    grade: row.grade ?? '-',
  }))
}

export async function listExamMasterData(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const [subjects, exams, students] = await Promise.all([
    supabase.from('subjects').select('id, name').eq('organization_id', organizationId).order('name'),
    supabase.from('exams').select('id, name').eq('organization_id', organizationId).order('name'),
    supabase.from('students').select('id, full_name').eq('organization_id', organizationId).order('full_name'),
  ])
  if (subjects.error) throw subjects.error
  if (exams.error) throw exams.error
  if (students.error) throw students.error
  return { subjects: subjects.data ?? [], exams: exams.data ?? [], students: students.data ?? [] }
}

export async function createMark(payload: {
  organizationId: string
  studentId: string
  subjectId: string
  examId: string
  score: number
  maxScore: number
}) {
  requireConfigured()
  const percent = payload.maxScore > 0 ? (payload.score / payload.maxScore) * 100 : 0
  const grade = percent >= 80 ? 'D1' : percent >= 70 ? 'D2' : percent >= 60 ? 'C3' : percent >= 50 ? 'C4' : percent >= 40 ? 'P7' : 'F9'
  const { error } = await supabase.from('marks').insert({
    organization_id: payload.organizationId,
    student_id: payload.studentId,
    subject_id: payload.subjectId,
    exam_id: payload.examId,
    score: payload.score,
    max_score: payload.maxScore,
    grade,
  })
  if (error) throw error
}

export async function getAcademicInsights(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('marks')
    .select('student_id, score, max_score, students(full_name, class_name)')
    .eq('organization_id', organizationId)
  if (error) throw error
  const rows = (data ?? []) as Array<{
    student_id: string
    score: number
    max_score: number
    students: { full_name: string; class_name: string }[]
  }>
  const map = new Map<string, { studentName: string; className: string; total: number; max: number }>()
  rows.forEach((row) => {
    const studentName = row.students?.[0]?.full_name ?? 'Unknown'
    const className = row.students?.[0]?.class_name ?? '-'
    const key = row.student_id
    const existing = map.get(key) ?? { studentName, className, total: 0, max: 0 }
    existing.total += Number(row.score ?? 0)
    existing.max += Number(row.max_score ?? 0)
    map.set(key, existing)
  })
  const ranking = Array.from(map.values())
    .map((v) => ({
      ...v,
      average: v.max > 0 ? (v.total / v.max) * 100 : 0,
    }))
    .sort((a, b) => b.average - a.average)
  const classAverageMap = new Map<string, { total: number; count: number }>()
  ranking.forEach((row) => {
    const c = classAverageMap.get(row.className) ?? { total: 0, count: 0 }
    c.total += row.average
    c.count += 1
    classAverageMap.set(row.className, c)
  })
  const classAverages = Array.from(classAverageMap.entries()).map(([className, v]) => ({
    className,
    average: v.count ? v.total / v.count : 0,
  }))
  return {
    ranking,
    classAverages,
    topPerformers: ranking.slice(0, 10),
  }
}

export async function getStudentReportCard(organizationId: string, studentId: string) {
  requireConfigured()
  const { data, error } = await supabase
    .from('marks')
    .select('score, max_score, grade, subjects(name), exams(name), students(full_name, class_name, admission_number)')
    .eq('organization_id', organizationId)
    .eq('student_id', studentId)
  if (error) throw error
  const marks = (data ?? []) as Array<{
    score: number
    max_score: number
    grade: string
    subjects: { name: string }[]
    exams: { name: string }[]
    students: { full_name: string; class_name: string; admission_number: string }[]
  }>
  const student = marks[0]?.students?.[0]
  const totalScore = marks.reduce((a, m) => a + Number(m.score ?? 0), 0)
  const totalMax = marks.reduce((a, m) => a + Number(m.max_score ?? 0), 0)
  const average = totalMax > 0 ? (totalScore / totalMax) * 100 : 0
  return {
    student,
    average,
    rows: marks.map((m) => ({
      subject: m.subjects?.[0]?.name ?? '-',
      exam: m.exams?.[0]?.name ?? '-',
      score: Number(m.score ?? 0),
      maxScore: Number(m.max_score ?? 0),
      grade: m.grade ?? '-',
    })),
  }
}

export async function listJournalEntries(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, entry_date, reference, description, source, entry_status')
    .eq('organization_id', organizationId)
    .order('posted_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function listRecentPayments(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, method, status, transaction_ref, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function listLedgerAccounts(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('ledger_accounts')
    .select('id, code, name, account_type, parent_id, is_system, sort_order')
    .eq('organization_id', organizationId)
    .order('sort_order')
    .order('code')
  if (error) throw error
  return data ?? []
}

export async function ensureDefaultLedgerAccounts(organizationId: string) {
  requireConfigured()
  const { error } = await supabase.rpc('ensure_default_ledger_accounts', { p_org: organizationId })
  if (error) throw error
}

export type TrialBalanceRow = {
  account_code: string
  account_name: string
  account_type: string
  debit_total: number
  credit_total: number
  net_balance: number
}

export async function fetchTrialBalance(organizationId: string, from: string, to: string) {
  requireConfigured()
  const { data, error } = await supabase.rpc('rpc_trial_balance', {
    p_org: organizationId,
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return (data ?? []) as TrialBalanceRow[]
}

export async function fetchProfitAndLoss(organizationId: string, from: string, to: string) {
  requireConfigured()
  const { data, error } = await supabase.rpc('rpc_profit_and_loss', {
    p_org: organizationId,
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return (data ?? []) as { section: string; amount: number }[]
}

export async function fetchBalanceSheetSummary(organizationId: string, asOf: string) {
  requireConfigured()
  const { data, error } = await supabase.rpc('rpc_balance_sheet_summary', {
    p_org: organizationId,
    p_as_of: asOf,
  })
  if (error) throw error
  return (data ?? []) as { bucket: string; amount: number }[]
}

export async function fetchFeeAgingBuckets(organizationId: string, asOf: string) {
  requireConfigured()
  const { data, error } = await supabase.rpc('rpc_fee_aging_buckets', {
    p_org: organizationId,
    p_as_of: asOf,
  })
  if (error) throw error
  return (data ?? []) as { bucket: string; outstanding: number }[]
}

export type ErpSearchHit = {
  result_type: string
  result_id: string
  label: string
  subtitle: string
  route_hint: string
}

export async function erpGlobalSearch(query: string, limit = 30) {
  requireConfigured()
  const { data, error } = await supabase.rpc('erp_global_search', {
    p_query: query.trim(),
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as ErpSearchHit[]
}

export async function listFinancePostingAudit(organizationId: string, limit = 150) {
  requireConfigured()
  const { data, error } = await supabase
    .from('finance_posting_audit')
    .select('id, journal_entry_id, event_kind, payload, actor_id, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function createJournalEntry(payload: {
  organizationId: string
  reference: string
  description: string
  debitAccountId: string
  creditAccountId: string
  amount: number
}) {
  requireConfigured()
  const { data: entry, error: entryError } = await supabase
    .from('journal_entries')
    .insert({
      organization_id: payload.organizationId,
      reference: payload.reference,
      description: payload.description,
      source: 'manual',
      entry_status: 'draft',
    })
    .select('id')
    .single()
  if (entryError || !entry) throw entryError ?? new Error('Failed to create journal entry')

  const { error: linesError } = await supabase.from('journal_lines').insert([
    {
      organization_id: payload.organizationId,
      journal_entry_id: entry.id,
      account_id: payload.debitAccountId,
      debit: payload.amount,
      credit: 0,
    },
    {
      organization_id: payload.organizationId,
      journal_entry_id: entry.id,
      account_id: payload.creditAccountId,
      debit: 0,
      credit: payload.amount,
    },
  ])
  if (linesError) throw linesError

  const { error: postError } = await supabase
    .from('journal_entries')
    .update({ entry_status: 'posted' })
    .eq('id', entry.id)
    .eq('organization_id', payload.organizationId)
  if (postError) throw postError
}

export async function logDataExport(payload: {
  organizationId: string
  module: string
  exportType: 'csv' | 'xlsx' | 'pdf' | 'print'
  filters?: Record<string, unknown>
}) {
  requireConfigured()
  const { error } = await supabase.from('data_exports').insert({
    organization_id: payload.organizationId,
    module: payload.module,
    export_type: payload.exportType,
    filters: payload.filters ?? {},
  })
  if (error) throw error
}

export async function createApprovalRequest(payload: {
  organizationId: string
  module: string
  entityTable: string
  requestType: string
  payload: Record<string, unknown>
}) {
  requireConfigured()
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('No authenticated user for approval request.')
  const { error } = await supabase.from('approval_requests').insert({
    organization_id: payload.organizationId,
    module: payload.module,
    entity_table: payload.entityTable,
    request_type: payload.requestType,
    payload: payload.payload,
    requested_by: userId,
  })
  if (error) throw error
}

export async function listAuditLogs(organizationId?: string | null, limit = 100) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, metadata, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function listApprovalRequests(organizationId?: string | null, status?: 'pending' | 'approved' | 'rejected') {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  let query = supabase
    .from('approval_requests')
    .select('id, module, entity_table, request_type, status, payload, comments, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function reviewApprovalRequest(payload: {
  organizationId: string
  requestId: string
  decision: 'approved' | 'rejected'
  comments?: string
}) {
  requireConfigured()
  const reviewerId = (await supabase.auth.getUser()).data.user?.id
  if (!reviewerId) throw new Error('No authenticated reviewer.')
  const { error } = await supabase
    .from('approval_requests')
    .update({
      status: payload.decision,
      comments: payload.comments ?? null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('organization_id', payload.organizationId)
    .eq('id', payload.requestId)
  if (error) throw error
}

export async function listCashierSessions(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('cashier_sessions')
    .select('id, opened_at, closed_at, opening_balance, closing_balance, expected_balance, variance, status')
    .eq('organization_id', organizationId)
    .order('opened_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function openCashierSession(payload: { organizationId: string; openingBalance: number }) {
  requireConfigured()
  const cashierId = (await supabase.auth.getUser()).data.user?.id
  if (!cashierId) throw new Error('No authenticated cashier.')
  const { error } = await supabase.from('cashier_sessions').insert({
    organization_id: payload.organizationId,
    cashier_id: cashierId,
    opening_balance: payload.openingBalance,
  })
  if (error) throw error
}

export async function closeCashierSession(payload: {
  organizationId: string
  sessionId: string
  closingBalance: number
  expectedBalance: number
}) {
  requireConfigured()
  const variance = payload.closingBalance - payload.expectedBalance
  const { error } = await supabase
    .from('cashier_sessions')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closing_balance: payload.closingBalance,
      expected_balance: payload.expectedBalance,
      variance,
    })
    .eq('organization_id', payload.organizationId)
    .eq('id', payload.sessionId)
    .eq('status', 'open')
  if (error) throw error
}

export async function listUnmatchedPayments(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('payments')
    .select('id, transaction_ref, amount, method, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'successful')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

export async function listBankStatementLines(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('bank_statement_lines')
    .select('id, statement_date, reference, narration, amount, direction, matched')
    .eq('organization_id', organizationId)
    .order('statement_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

export async function createBankStatementLine(payload: {
  organizationId: string
  statementDate: string
  reference: string
  narration: string
  amount: number
  direction: 'credit' | 'debit'
}) {
  requireConfigured()
  const { error } = await supabase.from('bank_statement_lines').insert({
    organization_id: payload.organizationId,
    statement_date: payload.statementDate,
    reference: payload.reference,
    narration: payload.narration,
    amount: payload.amount,
    direction: payload.direction,
  })
  if (error) throw error
}

export async function reconcilePayment(payload: {
  organizationId: string
  paymentId: string
  statementLineId: string
  notes?: string
}) {
  requireConfigured()
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('No authenticated reconciler.')
  const { error } = await supabase.from('reconciliation_matches').insert({
    organization_id: payload.organizationId,
    payment_id: payload.paymentId,
    statement_line_id: payload.statementLineId,
    matched_by: userId,
    notes: payload.notes ?? '',
  })
  if (error) throw error
  const { error: lineErr } = await supabase
    .from('bank_statement_lines')
    .update({ matched: true })
    .eq('organization_id', payload.organizationId)
    .eq('id', payload.statementLineId)
  if (lineErr) throw lineErr
}

export async function listArchivalRuns(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('archival_runs')
    .select('id, module, status, archived_rows, started_at, finished_at, error, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function queueArchivalRun(payload: { organizationId: string; module: string }) {
  requireConfigured()
  const userId = (await supabase.auth.getUser()).data.user?.id
  const { error } = await supabase.from('archival_runs').insert({
    organization_id: payload.organizationId,
    module: payload.module,
    status: 'queued',
    created_by: userId ?? null,
  })
  if (error) throw error
}

export async function listBackupRuns(organizationId?: string | null) {
  requireConfigured()
  const { data, error } = await supabase
    .from('backup_runs')
    .select('id, backup_scope, status, storage_uri, checksum, started_at, finished_at, error, created_at')
    .or(organizationId ? `organization_id.eq.${organizationId},organization_id.is.null` : 'organization_id.is.null')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function queueBackupRun(payload: { organizationId?: string; backupScope: 'tenant' | 'platform' }) {
  requireConfigured()
  const userId = (await supabase.auth.getUser()).data.user?.id
  const { error } = await supabase.from('backup_runs').insert({
    organization_id: payload.organizationId ?? null,
    backup_scope: payload.backupScope,
    status: 'queued',
    created_by: userId ?? null,
  })
  if (error) throw error
}

export async function seedDemoDataForOrganization(organizationId: string) {
  requireConfigured()
  const { data, error } = await supabase.rpc('seed_demo_school_data', { target_org: organizationId })
  if (error) throw error
  return data
}

export async function listPaymentWebhookEvents(organizationId?: string | null, limit = 80) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('payment_webhook_events')
    .select('id, provider, verified, transaction_ref, payload, created_at, organization_id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function listPaymentsForOps(organizationId?: string | null, status?: string, limit = 150) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  let q = supabase
    .from('payments')
    .select('id, amount, method, status, transaction_ref, webhook_verified, provider_response, created_at, student_id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function listBackgroundJobs(organizationId?: string | null, limit = 80) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('background_jobs')
    .select(
      'id, job_type, status, attempts, max_attempts, dead_letter, dead_letter_at, last_error, run_after, created_at, correlation_id, cron_expression, scheduled_next_at',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function enqueueBackgroundJob(payload: {
  organizationId: string
  jobType: string
  payload?: Record<string, unknown>
  runAfter?: string
}) {
  requireConfigured()
  const { error } = await supabase.from('background_jobs').insert({
    organization_id: payload.organizationId,
    job_type: payload.jobType,
    payload: payload.payload ?? {},
    run_after: payload.runAfter ?? new Date().toISOString(),
  })
  if (error) throw error
}

export async function retryBackgroundJob(jobId: string) {
  requireConfigured()
  const { error } = await supabase
    .from('background_jobs')
    .update({
      status: 'queued',
      dead_letter: false,
      dead_letter_at: null,
      last_error: null,
      run_after: new Date().toISOString(),
    })
    .eq('id', jobId)
  if (error) throw error
}

export async function listMessageOutbox(organizationId?: string | null, limit = 80) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('message_outbox')
    .select('id, channel, recipient, body, status, created_at, sent_at, provider_response')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function enqueueMessageOutbox(payload: {
  organizationId: string
  channel: 'sms' | 'whatsapp' | 'email' | 'push'
  recipient: string
  body: string
  relatedStudentId?: string | null
}) {
  requireConfigured()
  const { error } = await supabase.from('message_outbox').insert({
    organization_id: payload.organizationId,
    channel: payload.channel,
    recipient: payload.recipient,
    body: payload.body,
    related_student_id: payload.relatedStudentId ?? null,
    status: 'pending',
  })
  if (error) throw error
}

export async function listFinanceAdjustments(organizationId?: string | null, limit = 100) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('finance_adjustments')
    .select('id, adjustment_type, amount, percent, status, reason, created_at, student_id, invoice_id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function createFinanceAdjustmentRequest(payload: {
  organizationId: string
  studentId?: string | null
  invoiceId?: string | null
  adjustmentType: 'scholarship' | 'discount' | 'waiver' | 'late_fee' | 'refund' | 'reversal' | 'write_off'
  amount: number
  percent?: number | null
  reason?: string
}) {
  requireConfigured()
  const userId = (await supabase.auth.getUser()).data.user?.id
  const { error } = await supabase.from('finance_adjustments').insert({
    organization_id: payload.organizationId,
    student_id: payload.studentId ?? null,
    invoice_id: payload.invoiceId ?? null,
    adjustment_type: payload.adjustmentType,
    amount: payload.amount,
    percent: payload.percent ?? null,
    reason: payload.reason ?? '',
    status: 'pending',
    requested_by: userId ?? null,
  })
  if (error) throw error
}

export async function listClinicVisits(organizationId?: string | null, limit = 80) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('clinic_visits')
    .select('id, symptoms, diagnosis, visit_at, students(full_name)')
    .eq('organization_id', organizationId)
    .order('visit_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function listTransportRoutes(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('transport_routes')
    .select('id, name, code, driver_name, vehicle_plate')
    .eq('organization_id', organizationId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function listDormitoriesSummary(organizationId?: string | null) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('dormitories')
    .select('id, name, capacity, gender')
    .eq('organization_id', organizationId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function listBedAssignments(organizationId?: string | null, limit = 100) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('bed_assignments')
    .select('id, bed_label, assigned_on, dormitory_id, students(full_name), dormitories(name)')
    .eq('organization_id', organizationId)
    .order('assigned_on', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function listLibraryLoans(organizationId?: string | null, limit = 80) {
  requireConfigured()
  if (!organizationId) throw new Error('Missing organization context.')
  const { data, error } = await supabase
    .from('library_loans')
    .select('id, due_at, returned_at, students(full_name), library_books(title)')
    .eq('organization_id', organizationId)
    .order('due_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function listOrganizationsWithSubscriptions() {
  requireConfigured()
  const { data: orgs, error: oErr } = await supabase.from('organizations').select('id, name, school_type, active_academic_year, created_at').order('name')
  if (oErr) throw oErr
  const { data: subs, error: sErr } = await supabase.from('organization_subscriptions').select('organization_id, status, ends_at, plan_id')
  if (sErr) throw sErr
  const subByOrg = new Map((subs ?? []).map((s) => [(s as { organization_id: string }).organization_id, s]))
  return (orgs ?? []).map((o) => ({
    ...(o as Record<string, unknown>),
    subscription: subByOrg.get((o as { id: string }).id) ?? null,
  }))
}

export async function listStudentTransportAssignments(studentId: string) {
  requireConfigured()
  const { data, error } = await supabase
    .from('transport_assignments')
    .select('id, pickup_point, monthly_fee, active, transport_routes(name, code)')
    .eq('student_id', studentId)
  if (error) throw error
  return data ?? []
}

export async function listStudentBedAssignments(studentId: string) {
  requireConfigured()
  const { data, error } = await supabase
    .from('bed_assignments')
    .select('id, bed_label, assigned_on, dormitories(name)')
    .eq('student_id', studentId)
    .order('assigned_on', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listStudentClinicVisits(studentId: string) {
  requireConfigured()
  const { data, error } = await supabase
    .from('clinic_visits')
    .select('id, symptoms, diagnosis, treatment, visit_at')
    .eq('student_id', studentId)
    .order('visit_at', { ascending: false })
    .limit(40)
  if (error) throw error
  return data ?? []
}

export async function markBackgroundJobDeadLetter(jobId: string, reason?: string) {
  requireConfigured()
  const { error } = await supabase
    .from('background_jobs')
    .update({
      dead_letter: true,
      dead_letter_at: new Date().toISOString(),
      status: 'failed',
      last_error: reason ?? 'Marked dead-letter',
    })
    .eq('id', jobId)
  if (error) throw error
}

