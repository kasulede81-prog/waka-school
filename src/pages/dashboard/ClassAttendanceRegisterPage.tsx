import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  createAttendanceSession,
  listDistinctClassNames,
  listStudentsInClass,
  resolveAttendanceSessionToken,
  saveClassAttendanceRegister,
  type StudentAttendanceStatus,
} from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'
import clsx from 'clsx'

const statuses: StudentAttendanceStatus[] = ['present', 'absent', 'sick', 'late', 'excused']

export function ClassAttendanceRegisterPage() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const tokenParam = params.get('token') ?? ''

  const [classes, setClasses] = useState<Array<{ className: string; streams: string[] }>>([])
  const [className, setClassName] = useState('')
  const [stream, setStream] = useState('')
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [publicToken, setPublicToken] = useState<string | null>(null)
  const [students, setStudents] = useState<Array<{ id: string; full_name: string; admission_number: string }>>([])
  const [marks, setMarks] = useState<Record<string, StudentAttendanceStatus>>({})
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const streamOptions = useMemo(() => classes.find((c) => c.className === className)?.streams ?? [], [classes, className])

  async function loadClasses() {
    if (!profile?.organization_id) return
    try {
      const data = await listDistinctClassNames(profile.organization_id)
      setClasses(data)
      if (!className && data[0]) setClassName(data[0].className)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void loadClasses()
  }, [profile?.organization_id])

  useEffect(() => {
    async function hydrateFromToken() {
      if (!tokenParam || !profile?.id) return
      try {
        const res = await resolveAttendanceSessionToken(tokenParam)
        if (res?.ok === true) {
          setSessionId(String(res.session_id))
          setPublicToken(tokenParam)
          setClassName(String(res.class_name))
          setStream(String(res.stream ?? ''))
          setSessionDate(String(res.session_date).slice(0, 10))
        }
      } catch (e) {
        setError((e as Error).message)
      }
    }
    void hydrateFromToken()
  }, [tokenParam, profile?.id])

  async function loadRoster() {
    if (!profile?.organization_id || !className) return
    setError('')
    try {
      const roster = await listStudentsInClass(profile.organization_id, className, stream || null)
      setStudents(roster as Array<{ id: string; full_name: string; admission_number: string }>)
      const init: Record<string, StudentAttendanceStatus> = {}
      for (const s of roster) init[s.id] = 'present'
      setMarks(init)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void loadRoster()
  }, [profile?.organization_id, className, stream])

  async function openSession() {
    if (!profile?.organization_id || !profile.id || !className) return
    setError('')
    setMsg('')
    try {
      const row = await createAttendanceSession({
        organizationId: profile.organization_id,
        className,
        stream: stream || '',
        sessionDate,
        openedBy: profile.id,
        expiresAt: null,
      })
      setSessionId(row.id)
      setPublicToken(row.public_token)
      setMsg('Session opened. Share the secure link with assistant devices (staff must be signed in).')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function saveAll() {
    if (!sessionId) {
      setError('Open a session first.')
      return
    }
    setError('')
    setMsg('')
    try {
      const entries = students.map((s) => ({ student_id: s.id, status: marks[s.id] ?? 'present' }))
      const res = await saveClassAttendanceRegister(sessionId, entries)
      if (res?.ok === true) {
        setMsg(`Saved register (${String(res.applied)} rows).`)
      } else {
        setError(String(res?.error ?? 'Save failed'))
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function markAll(status: StudentAttendanceStatus) {
    const next: Record<string, StudentAttendanceStatus> = { ...marks }
    for (const s of students) next[s.id] = status
    setMarks(next)
  }

  const shareUrl =
    publicToken && typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/attendance/register?token=${publicToken}`
      : publicToken
        ? `?token=${publicToken}`
        : ''

  return (
    <section className="space-y-4">
      <ErpToolbar
        title="Class attendance register"
        subtitle="Session-based register with sick / excused codes, bulk actions, and Supabase-backed instant saves."
        search=""
        onSearchChange={() => {}}
        onCsv={() => {}}
        onXlsx={() => {}}
        onPrint={() => {}}
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link to="/dashboard/attendance" className="text-emerald-700 underline dark:text-emerald-400">
          Attendance overview
        </Link>
        <Link to="/dashboard/attendance/staff-qr" className="text-emerald-700 underline dark:text-emerald-400">
          Staff QR cards
        </Link>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-4 dark:border-slate-800">
        <select value={className} onChange={(e) => { setClassName(e.target.value); setStream('') }} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
          {classes.map((c) => (
            <option key={c.className} value={c.className}>
              {c.className}
            </option>
          ))}
        </select>
        <select value={stream} onChange={(e) => setStream(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
          <option value="">All streams</option>
          {streamOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        <button type="button" onClick={() => void openSession()} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white">
          Open session
        </button>
      </div>

      {sessionId ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
          <p className="font-semibold">Secure session link (requires staff login)</p>
          <p className="mt-1 break-all font-mono">{shareUrl}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => markAll('present')} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-white dark:bg-slate-200 dark:text-slate-900">
          Mark all present
        </button>
        <button type="button" onClick={() => void saveAll()} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white">
          Save register
        </button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{msg}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
            <tr>
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Admission</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const st = marks[s.id] ?? 'present'
              const absentLike = st === 'absent' || st === 'sick'
              return (
                <tr key={s.id} className={clsx('border-b border-slate-100 dark:border-slate-900', absentLike && 'bg-amber-50 dark:bg-amber-950/20')}>
                  <td className="px-2 py-2">{s.full_name}</td>
                  <td className="px-2 py-2 font-mono text-xs">{s.admission_number}</td>
                  <td className="px-2 py-2">
                    <select
                      value={st}
                      onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value as StudentAttendanceStatus }))}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      {statuses.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!students.length ? <p className="text-sm text-slate-500">No students in this class/stream.</p> : null}
    </section>
  )
}
