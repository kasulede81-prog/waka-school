import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { bulkUpdateStudentStatus, createStudent, deleteStudent, listStudents, logDataExport, updateStudent } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'
import { exportToCsv, exportToXlsx, printRows } from '../../lib/export-utils'
import type { Student } from '../../types'

export function StudentsPage() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const searchQ = params.get('q') ?? ''
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    fullName: '',
    admissionNumber: '',
    className: '',
    stream: '',
    parentPhone: '',
  })

  async function loadStudents() {
    setLoading(true)
    setError('')
    try {
      const data = await listStudents(profile?.organization_id, { search: searchQ || undefined, limit: 500 })
      setStudents(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudents()
  }, [profile?.organization_id, searchQ])

  async function submitStudent() {
    if (!profile?.organization_id) return
    if (!form.fullName || !form.admissionNumber || !form.className) return
    try {
      await createStudent({
        organizationId: profile.organization_id,
        fullName: form.fullName,
        admissionNumber: form.admissionNumber,
        className: form.className,
        stream: form.stream,
        parentPhone: form.parentPhone,
      })
      setForm({ fullName: '', admissionNumber: '', className: '', stream: '', parentPhone: '' })
      await loadStudents()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function saveStudentEdit(studentId: string) {
    if (!profile?.organization_id) return
    const target = students.find((s) => s.id === studentId)
    if (!target) return
    try {
      await updateStudent({
        organizationId: profile.organization_id,
        studentId,
        fullName: target.fullName,
        className: target.className,
        stream: target.stream,
        parentPhone: target.parentPhone,
        status: target.status,
      })
      setEditingId(null)
      await loadStudents()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function removeStudent(studentId: string) {
    if (!profile?.organization_id) return
    if (!window.confirm('Delete this student?')) return
    try {
      await deleteStudent(profile.organization_id, studentId)
      await loadStudents()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const filteredStudents = students.filter((student) => {
    const q = search.toLowerCase()
    return (
      student.fullName.toLowerCase().includes(q) ||
      student.admissionNumber.toLowerCase().includes(q) ||
      student.className.toLowerCase().includes(q) ||
      student.parentPhone.toLowerCase().includes(q)
    )
  })

  const exportRows = filteredStudents.map((student) => ({
    AdmissionNumber: student.admissionNumber,
    Student: student.fullName,
    Class: `${student.className} ${student.stream}`,
    ParentPhone: student.parentPhone,
    Status: student.status,
  }))

  async function handleExport(type: 'csv' | 'xlsx' | 'print') {
    if (!profile?.organization_id) return
    if (type === 'csv') exportToCsv('students.csv', exportRows)
    if (type === 'xlsx') exportToXlsx('students.xlsx', exportRows)
    if (type === 'print') printRows('Student Registry', exportRows)
    await logDataExport({
      organizationId: profile.organization_id,
      module: 'students',
      exportType: type === 'print' ? 'print' : type,
      filters: { search },
    })
  }

  async function bulkSetStatus(status: Student['status']) {
    if (!profile?.organization_id || !selected.length) return
    try {
      await bulkUpdateStudentStatus({
        organizationId: profile.organization_id,
        studentIds: selected,
        status,
      })
      setSelected([])
      await loadStudents()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <ErpToolbar
        title="Student Registry"
        subtitle="Registration, class assignment, guardian contacts, exports, and bulk lifecycle actions."
        search={search}
        onSearchChange={setSearch}
        onCsv={() => handleExport('csv')}
        onXlsx={() => handleExport('xlsx')}
        onPrint={() => handleExport('print')}
      />
      <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-5 dark:border-slate-800">
        <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" placeholder="Full name" />
        <input value={form.admissionNumber} onChange={(e) => setForm((f) => ({ ...f, admissionNumber: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" placeholder="Admission no" />
        <input value={form.className} onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" placeholder="Class" />
        <input value={form.stream} onChange={(e) => setForm((f) => ({ ...f, stream: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" placeholder="Stream" />
        <div className="flex gap-2">
          <input value={form.parentPhone} onChange={(e) => setForm((f) => ({ ...f, parentPhone: e.target.value }))} className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" placeholder="Parent phone" />
          <button onClick={submitStudent} className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white">Add</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={!selected.length} onClick={() => bulkSetStatus('active')} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-slate-700">Mark Active</button>
        <button disabled={!selected.length} onClick={() => bulkSetStatus('inactive')} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-slate-700">Mark Inactive</button>
        <button disabled={!selected.length} onClick={() => bulkSetStatus('graduated')} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-slate-700">Mark Graduated</button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {loading ? <p className="text-xs text-slate-500">Loading students...</p> : null}
      {!loading && filteredStudents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
          No students found. <button onClick={loadStudents} className="underline">Retry</button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={filteredStudents.length > 0 && selected.length === filteredStudents.length}
                  onChange={(e) => setSelected(e.target.checked ? filteredStudents.map((s) => s.id) : [])}
                />
              </th>
              <th className="px-2 py-2">Admission No.</th>
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Class/Stream</th>
              <th className="px-2 py-2">Parent Phone</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr key={student.id} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-2 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(student.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, student.id] : prev.filter((id) => id !== student.id),
                      )
                    }
                  />
                </td>
                <td className="px-2 py-3">{student.admissionNumber}</td>
                <td className="px-2 py-3">
                  {editingId === student.id ? (
                    <input
                      value={student.fullName}
                      onChange={(e) =>
                        setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, fullName: e.target.value } : s)))
                      }
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  ) : (
                    student.fullName
                  )}
                </td>
                <td className="px-2 py-3">
                  {editingId === student.id ? (
                    <div className="flex gap-1">
                      <input
                        value={student.className}
                        onChange={(e) =>
                          setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, className: e.target.value } : s)))
                        }
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        value={student.stream}
                        onChange={(e) =>
                          setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, stream: e.target.value } : s)))
                        }
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  ) : (
                    `${student.className} - ${student.stream}`
                  )}
                </td>
                <td className="px-2 py-3">
                  {editingId === student.id ? (
                    <input
                      value={student.parentPhone}
                      onChange={(e) =>
                        setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, parentPhone: e.target.value } : s)))
                      }
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  ) : (
                    student.parentPhone
                  )}
                </td>
                <td className="px-2 py-3">
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs capitalize text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {student.status}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex gap-2">
                    {editingId === student.id ? (
                      <>
                        <button onClick={() => saveStudentEdit(student.id)} className="rounded border border-emerald-500 px-2 py-1 text-xs text-emerald-700">Save</button>
                        <button onClick={() => setEditingId(null)} className="rounded border border-slate-300 px-2 py-1 text-xs">Cancel</button>
                      </>
                    ) : (
                      <>
                        <Link to={`/dashboard/students/${student.id}`} className="rounded border border-emerald-500 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400">
                          Profile
                        </Link>
                        <button onClick={() => setEditingId(student.id)} className="rounded border border-slate-300 px-2 py-1 text-xs">Edit</button>
                        <button onClick={() => removeStudent(student.id)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">Delete</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

