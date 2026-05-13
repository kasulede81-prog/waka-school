import { useEffect, useState } from 'react'
import { createAttendance, createTeacherAttendance, getAttendanceAnalytics, listAttendance, listStudents, listTeacherAttendance, listTeachers, logDataExport, sendAttendanceAlert } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'
import { exportToCsv, exportToXlsx, printRows } from '../../lib/export-utils'
import type { Student } from '../../types'

type AttendanceItem = {
  id: string
  studentName: string
  date: string
  status: 'present' | 'absent' | 'late' | 'sick' | 'excused'
  notes: string
}

export function AttendancePage() {
  const { profile } = useAuth()
  const [analytics, setAnalytics] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    sick: 0,
    excused: 0,
    attendanceRate: 0,
    absenteeSmsList: [] as Array<{ studentName: string; parentPhone: string; date: string }>,
  })
  const [rows, setRows] = useState<AttendanceItem[]>([])
  const [teacherRows, setTeacherRows] = useState<Array<{ id: string; attendance_date: string; status: 'present' | 'absent' | 'late'; notes: string; teachers: { full_name: string }[] }>>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([])
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    studentId: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'present' as 'present' | 'absent' | 'late' | 'sick' | 'excused',
    notes: '',
  })
  const [teacherForm, setTeacherForm] = useState({
    teacherId: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'present' as 'present' | 'absent' | 'late',
    notes: '',
  })

  async function refresh() {
    try {
      const [attendanceData, studentData] = await Promise.all([
        listAttendance(profile?.organization_id),
        listStudents(profile?.organization_id),
      ])
      const [teacherAttendanceData, teacherData, analyticsData] = await Promise.all([
        listTeacherAttendance(profile?.organization_id),
        listTeachers(profile?.organization_id),
        getAttendanceAnalytics(profile?.organization_id),
      ])
      setRows(attendanceData)
      setStudents(studentData)
      setTeacherRows(teacherAttendanceData)
      setTeachers(teacherData as Array<{ id: string; full_name: string }>)
      setAnalytics(analyticsData)
      if (!form.studentId && studentData.length) {
        setForm((prev) => ({ ...prev, studentId: studentData[0].id }))
      }
      if (!teacherForm.teacherId && (teacherData as Array<{ id: string }>).length) {
        setTeacherForm((prev) => ({ ...prev, teacherId: (teacherData as Array<{ id: string }>)[0].id }))
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    refresh()
  }, [profile?.organization_id])

  async function submitAttendance() {
    if (!profile?.organization_id || !form.studentId) return
    setError('')
    setStatusMsg('')
    try {
      await createAttendance({
        organizationId: profile.organization_id,
        studentId: form.studentId,
        date: form.date,
        status: form.status,
        notes: form.notes,
      })
      if (form.status !== 'present' && form.status !== 'excused') {
        await sendAttendanceAlert({
          organizationId: profile.organization_id,
          title: 'Attendance Alert',
          body: `Student marked as ${form.status} on ${form.date}.`,
        })
      }
      setStatusMsg('Attendance saved successfully.')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function submitTeacherAttendance() {
    if (!profile?.organization_id || !teacherForm.teacherId) return
    try {
      await createTeacherAttendance({
        organizationId: profile.organization_id,
        teacherId: teacherForm.teacherId,
        date: teacherForm.date,
        status: teacherForm.status,
        notes: teacherForm.notes,
      })
      setStatusMsg('Teacher attendance saved.')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const filteredRows = rows.filter((row) => {
    const q = search.toLowerCase()
    return row.studentName.toLowerCase().includes(q) || row.status.toLowerCase().includes(q) || row.date.includes(q)
  })

  const exportRows = filteredRows.map((row) => ({
    Date: row.date,
    Student: row.studentName,
    Status: row.status,
    Notes: row.notes,
  }))

  async function handleExport(type: 'csv' | 'xlsx' | 'print') {
    if (!profile?.organization_id) return
    if (type === 'csv') exportToCsv('attendance.csv', exportRows)
    if (type === 'xlsx') exportToXlsx('attendance.xlsx', exportRows)
    if (type === 'print') printRows('Attendance Register', exportRows)
    await logDataExport({
      organizationId: profile.organization_id,
      module: 'attendance',
      exportType: type === 'print' ? 'print' : type,
      filters: { search, date: form.date },
    })
  }

  return (
    <section className="space-y-4">
      <ErpToolbar
        title="Attendance Control"
        subtitle="Daily class register, absence alerts, and export-ready institutional attendance reports."
        search={search}
        onSearchChange={setSearch}
        onCsv={() => handleExport('csv')}
        onXlsx={() => handleExport('xlsx')}
        onPrint={() => handleExport('print')}
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <a href="/dashboard/attendance/register" className="text-emerald-700 underline dark:text-emerald-400">
          Class register (sessions)
        </a>
        <a href="/dashboard/attendance/staff-qr" className="text-emerald-700 underline dark:text-emerald-400">
          Staff QR IDs
        </a>
        <a href="/kiosk/staff" target="_blank" rel="noreferrer" className="text-emerald-700 underline dark:text-emerald-400">
          Staff kiosk (new tab)
        </a>
      </div>

      <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-5 dark:border-slate-800">
        <select value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </select>
        <input value={form.date} type="date" onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="sick">Sick</option>
          <option value="excused">Excused</option>
        </select>
        <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes" className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <button onClick={submitAttendance} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white">Save</button>
      </div>
      <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-5 dark:border-slate-800">
        <select value={teacherForm.teacherId} onChange={(e) => setTeacherForm((f) => ({ ...f, teacherId: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        <input value={teacherForm.date} type="date" onChange={(e) => setTeacherForm((f) => ({ ...f, date: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <select value={teacherForm.status} onChange={(e) => setTeacherForm((f) => ({ ...f, status: e.target.value as 'present' | 'absent' | 'late' }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
        </select>
        <input value={teacherForm.notes} onChange={(e) => setTeacherForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Teacher notes" className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <button onClick={submitTeacherAttendance} className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white">Save Teacher</button>
      </div>

      {statusMsg ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{statusMsg}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-6">
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">Attendance Rate: <strong>{analytics.attendanceRate.toFixed(1)}%</strong></div>
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">Present: <strong>{analytics.present}</strong></div>
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">Absent: <strong>{analytics.absent}</strong></div>
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">Late: <strong>{analytics.late}</strong></div>
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">Sick: <strong>{analytics.sick}</strong></div>
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">Excused: <strong>{analytics.excused}</strong></div>
      </div>
      {analytics.absenteeSmsList.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          SMS-ready absentee list: {analytics.absenteeSmsList.slice(0, 10).map((r) => `${r.studentName} (${r.parentPhone})`).join(', ')}
        </div>
      ) : null}
      {!rows.length ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
          No attendance records yet. <button onClick={refresh} className="underline">Retry</button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-2 py-2">{row.date}</td>
                <td className="px-2 py-2">{row.studentName}</td>
                <td className="px-2 py-2 capitalize">{row.status}</td>
                <td className="px-2 py-2">{row.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-2 py-2">Teacher Date</th>
              <th className="px-2 py-2">Teacher</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {teacherRows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-2 py-2">{row.attendance_date}</td>
                <td className="px-2 py-2">{row.teachers?.[0]?.full_name ?? '-'}</td>
                <td className="px-2 py-2 capitalize">{row.status}</td>
                <td className="px-2 py-2">{row.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

