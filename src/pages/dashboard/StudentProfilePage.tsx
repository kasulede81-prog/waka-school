import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createFeeChargeLine,
  getStudentRecord,
  listFeeChargeLinesForStudent,
  listStudentAttendanceRecent,
  listStudentBedAssignments,
  listStudentClinicVisits,
  listStudentInvoices,
  listStudentMarks,
  listStudentReportCards,
  listStudentTransportAssignments,
  type FeeChargeLineRow,
  type StudentAttendanceStatus,
} from '../../lib/data-service'
import { exportInstitutionalPdf } from '../../lib/pdf-export'
import { useAuth } from '../../lib/auth'

const UGX = new Intl.NumberFormat('en-UG')

const financeRoles = ['super_admin', 'school_director', 'bursar', 'accountant', 'head_teacher']

export function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'overview' | 'finance' | 'attendance' | 'academics' | 'operations'>('overview')
  const [student, setStudent] = useState<Awaited<ReturnType<typeof getStudentRecord>> | null>(null)
  const [feeLines, setFeeLines] = useState<FeeChargeLineRow[]>([])
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([])
  const [attendance, setAttendance] = useState<Array<{ attendance_date: string; status: StudentAttendanceStatus; notes: string | null }>>([])
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([])
  const [marks, setMarks] = useState<Array<Record<string, unknown>>>([])
  const [transport, setTransport] = useState<Array<Record<string, unknown>>>([])
  const [beds, setBeds] = useState<Array<Record<string, unknown>>>([])
  const [clinic, setClinic] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')
  const [feeForm, setFeeForm] = useState({
    category: 'tuition',
    academicYear: String(new Date().getFullYear()),
    term: 'Term 1',
    amount: '',
    dueDate: '',
  })

  const isParent = profile?.role === 'parent'
  const canAddFeeLine = profile && financeRoles.includes(profile.role)

  async function load() {
    if (!studentId) return
    setError('')
    try {
      const s = await getStudentRecord(studentId)
      setStudent(s)
      const [fl, inv, att, rep, mk, tr, bd, cl] = await Promise.all([
        listFeeChargeLinesForStudent(studentId),
        listStudentInvoices(studentId),
        listStudentAttendanceRecent(studentId),
        listStudentReportCards(studentId),
        listStudentMarks(studentId),
        listStudentTransportAssignments(studentId),
        listStudentBedAssignments(studentId),
        listStudentClinicVisits(studentId),
      ])
      setFeeLines(fl)
      setInvoices(inv)
      setAttendance(att)
      setReports(rep)
      setMarks(mk)
      setTransport(tr as Array<Record<string, unknown>>)
      setBeds(bd as Array<Record<string, unknown>>)
      setClinic(cl as Array<Record<string, unknown>>)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [studentId])

  const totalBilled = feeLines.reduce((a, r) => a + Number(r.amount_billed ?? 0), 0)
  const totalPaidLines = feeLines.reduce((a, r) => a + Number(r.amount_paid ?? 0), 0)
  const totalBalance = feeLines.reduce((a, r) => a + Number(r.balance ?? 0), 0)
  const invOutstanding = invoices.reduce((a, r) => a + Number(r.balance ?? 0), 0)

  async function addFeeLine() {
    if (!student || !profile?.organization_id || !studentId || !feeForm.amount) return
    try {
      await createFeeChargeLine({
        organizationId: profile.organization_id,
        studentId,
        feeCategory: feeForm.category,
        academicYear: feeForm.academicYear,
        term: feeForm.term,
        amountBilled: Number(feeForm.amount),
        dueDate: feeForm.dueDate || null,
      })
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function downloadFinancePdf() {
    if (!student) return
    const columns = ['Category', 'Term', 'Billed', 'Paid', 'Balance', 'Due']
    const rows =
      feeLines.length > 0
        ? feeLines.map((r) => ({
            Category: r.fee_category,
            Term: `${r.term} ${r.academic_year}`,
            Billed: Number(r.amount_billed),
            Paid: Number(r.amount_paid),
            Balance: Number(r.balance),
            Due: r.due_date ?? '',
          }))
        : [
            {
              Category: 'No fee lines',
              Term: '—',
              Billed: 0,
              Paid: 0,
              Balance: 0,
              Due: '',
            },
          ]
    await exportInstitutionalPdf({
      filename: `student-statement-${student.admission_number}.pdf`,
      title: 'Fee statement',
      subtitle: `${student.full_name} · ${student.admission_number}`,
      schoolName: 'Waka School ERP',
      verificationCode: `WAKA-VERIFY:${student.id}`,
      columns,
      rows,
    })
  }

  if (!studentId) return null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={() => navigate(isParent ? '/portal' : '/dashboard/students')}
            className="text-xs text-emerald-700 underline dark:text-emerald-400"
          >
            {isParent ? '← Children' : '← Registry'}
          </button>
          <h2 className="text-xl font-semibold">{student?.full_name ?? 'Student profile'}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Institutional ERP record — academics, finance, and attendance in one view.</p>
        </div>
        {!isParent ? (
          <Link to={`/dashboard/attendance/register`} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-600">
            Class register
          </Link>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        {(['overview', 'finance', 'attendance', 'academics', 'operations'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              tab === t ? 'bg-emerald-600 text-white' : 'border border-slate-300 dark:border-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && student ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bio & registration</h3>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Admission</dt>
                <dd className="font-mono">{student.admission_number}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Class / stream</dt>
                <dd>
                  {student.class_name} / {student.stream ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Status</dt>
                <dd className="capitalize">{student.status}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Gender</dt>
                <dd className="capitalize">{student.gender}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">DOB</dt>
                <dd>{student.date_of_birth ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Guardian phone</dt>
                <dd>{student.parent_phone ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Email</dt>
                <dd>{student.parent_email ?? '—'}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Medical</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{student.medical_notes?.trim() ? student.medical_notes : 'No medical alerts recorded.'}</p>
            <h3 className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Address</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{student.address?.trim() ? student.address : '—'}</p>
          </div>
        </div>
      ) : null}

      {tab === 'finance' ? (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-4 dark:border-slate-800">
            <div className="text-sm">
              <p className="text-slate-500">Fee lines billed</p>
              <p className="text-lg font-semibold">UGX {UGX.format(totalBilled)}</p>
            </div>
            <div className="text-sm">
              <p className="text-slate-500">Fee lines paid</p>
              <p className="text-lg font-semibold">UGX {UGX.format(totalPaidLines)}</p>
            </div>
            <div className="text-sm">
              <p className="text-slate-500">Fee line balance</p>
              <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">UGX {UGX.format(totalBalance)}</p>
            </div>
            <div className="text-sm">
              <p className="text-slate-500">Invoice outstanding</p>
              <p className="text-lg font-semibold">UGX {UGX.format(invOutstanding)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadFinancePdf()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-600"
            >
              Download PDF statement
            </button>
          </div>

          {canAddFeeLine ? (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold">Add fee charge line</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-5">
                <input value={feeForm.category} onChange={(e) => setFeeForm((f) => ({ ...f, category: e.target.value }))} className="rounded-md border px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" placeholder="Category" />
                <input value={feeForm.academicYear} onChange={(e) => setFeeForm((f) => ({ ...f, academicYear: e.target.value }))} className="rounded-md border px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" />
                <input value={feeForm.term} onChange={(e) => setFeeForm((f) => ({ ...f, term: e.target.value }))} className="rounded-md border px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" />
                <input value={feeForm.amount} onChange={(e) => setFeeForm((f) => ({ ...f, amount: e.target.value }))} className="rounded-md border px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" placeholder="Amount" />
                <input type="date" value={feeForm.dueDate} onChange={(e) => setFeeForm((f) => ({ ...f, dueDate: e.target.value }))} className="rounded-md border px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <button type="button" onClick={() => void addFeeLine()} className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white">
                Add line
              </button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
                <tr>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Term</th>
                  <th className="px-2 py-2">Billed</th>
                  <th className="px-2 py-2">Paid</th>
                  <th className="px-2 py-2">Balance</th>
                  <th className="px-2 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {feeLines.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="px-2 py-2 capitalize">{r.fee_category}</td>
                    <td className="px-2 py-2">
                      {r.term} {r.academic_year}
                    </td>
                    <td className="px-2 py-2">UGX {UGX.format(Number(r.amount_billed))}</td>
                    <td className="px-2 py-2">UGX {UGX.format(Number(r.amount_paid))}</td>
                    <td className="px-2 py-2 font-medium text-amber-700 dark:text-amber-400">UGX {UGX.format(Number(r.balance))}</td>
                    <td className="px-2 py-2">{r.due_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!feeLines.length ? <p className="p-3 text-xs text-slate-500">No granular fee lines yet — use Billing to post charges.</p> : null}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <h3 className="border-b bg-slate-50 px-2 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/80">Invoices</h3>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b dark:border-slate-800">
                <tr>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Total</th>
                  <th className="px-2 py-2">Paid</th>
                  <th className="px-2 py-2">Balance</th>
                  <th className="px-2 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((r) => (
                  <tr key={String(r.id)} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="px-2 py-2 capitalize">{String(r.status ?? '')}</td>
                    <td className="px-2 py-2">UGX {UGX.format(Number(r.total_amount))}</td>
                    <td className="px-2 py-2">UGX {UGX.format(Number(r.amount_paid))}</td>
                    <td className="px-2 py-2">UGX {UGX.format(Number(r.balance))}</td>
                    <td className="px-2 py-2">{String(r.due_date ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!invoices.length ? <p className="p-3 text-xs text-slate-500">No invoices.</p> : null}
          </div>
        </div>
      ) : null}

      {tab === 'attendance' ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((r) => (
                <tr key={`${r.attendance_date}-${r.status}`} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-2 py-2">{r.attendance_date}</td>
                  <td className="px-2 py-2 capitalize">{r.status}</td>
                  <td className="px-2 py-2">{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!attendance.length ? <p className="p-3 text-xs text-slate-500">No attendance rows.</p> : null}
        </div>
      ) : null}

      {tab === 'operations' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold">Transport</h3>
            <ul className="mt-2 space-y-2 text-xs">
              {transport.map((t) => {
                const rt = t.transport_routes as { name?: string; code?: string } | { name?: string; code?: string }[] | null | undefined
                const route = Array.isArray(rt) ? rt[0] : rt
                return (
                  <li key={String(t.id)} className="border-b border-slate-100 pb-2 dark:border-slate-900">
                    <span className="font-medium">{route?.name ?? 'Route'}</span> ({route?.code ?? '—'}) — {t.active ? 'active' : 'inactive'}
                    <div className="text-slate-500">Pickup: {String(t.pickup_point ?? '—')}</div>
                  </li>
                )
              })}
            </ul>
            {!transport.length ? <p className="text-xs text-slate-500">No transport assignment.</p> : null}
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold">Boarding</h3>
            <ul className="mt-2 space-y-2 text-xs">
              {beds.map((b) => {
                const d = b.dormitories as { name?: string } | { name?: string }[] | null | undefined
                const dorm = Array.isArray(d) ? d[0] : d
                return (
                  <li key={String(b.id)} className="border-b border-slate-100 pb-2 dark:border-slate-900">
                    {dorm?.name ?? 'Dorm'} — bed {String(b.bed_label)} from {String(b.assigned_on)}
                  </li>
                )
              })}
            </ul>
            {!beds.length ? <p className="text-xs text-slate-500">No dormitory assignment.</p> : null}
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold">Clinic</h3>
            <ul className="mt-2 space-y-2 text-xs">
              {clinic.map((c) => (
                <li key={String(c.id)} className="border-b border-slate-100 pb-2 dark:border-slate-900">
                  <span className="font-medium">{new Date(String(c.visit_at)).toLocaleString()}</span>
                  <div>{String(c.symptoms ?? '—')}</div>
                  <div className="text-slate-500">{String(c.diagnosis ?? '')}</div>
                </li>
              ))}
            </ul>
            {!clinic.length ? <p className="text-xs text-slate-500">No clinic visits recorded.</p> : null}
          </div>
        </div>
      ) : null}

      {tab === 'academics' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800">
            <h3 className="border-b bg-slate-50 px-2 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/80">Report cards</h3>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-900">
              {reports.map((r, i) => (
                <li key={i} className="px-2 py-2">
                  <span className="font-medium">{String(r.exam_name)}</span> — {String(r.term)} {String(r.academic_year)}
                  <span className="ml-2 text-slate-500">
                    Div {String(r.division ?? '—')} / Agg {String(r.aggregate ?? '—')}
                  </span>
                </li>
              ))}
            </ul>
            {!reports.length ? <p className="p-3 text-xs text-slate-500">No report cards.</p> : null}
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800">
            <h3 className="border-b bg-slate-50 px-2 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/80">Marks</h3>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-900">
              {marks.map((r, i) => {
                const subj = (r.subjects as { name: string }[] | null)?.[0]?.name ?? 'Subject'
                const ex = (r.exams as { name: string }[] | null)?.[0]?.name ?? 'Exam'
                return (
                  <li key={i} className="px-2 py-2">
                    {subj} — {ex}: {String(r.score)}/{String(r.max_score)} ({String(r.grade ?? '')})
                  </li>
                )
              })}
            </ul>
            {!marks.length ? <p className="p-3 text-xs text-slate-500">No marks.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
