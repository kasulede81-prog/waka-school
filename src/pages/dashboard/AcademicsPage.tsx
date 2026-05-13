import { useEffect, useState } from 'react'
import { createMark, getAcademicInsights, getStudentReportCard, listExamMasterData, listMarks, logDataExport } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'
import { exportToCsv, exportToXlsx, printRows } from '../../lib/export-utils'

type MarkView = {
  id: string
  studentName: string
  subjectName: string
  examName: string
  score: number
  maxScore: number
  grade: string
}

type Option = { id: string; name?: string; full_name?: string }

export function AcademicsPage() {
  const { profile } = useAuth()
  const [marks, setMarks] = useState<MarkView[]>([])
  const [students, setStudents] = useState<Option[]>([])
  const [subjects, setSubjects] = useState<Option[]>([])
  const [exams, setExams] = useState<Option[]>([])
  const [ranking, setRanking] = useState<Array<{ studentName: string; className: string; average: number }>>([])
  const [classAverages, setClassAverages] = useState<Array<{ className: string; average: number }>>([])
  const [selectedStudentReport, setSelectedStudentReport] = useState<string>('')
  const [reportAverage, setReportAverage] = useState(0)
  const [reportRows, setReportRows] = useState<Array<{ subject: string; exam: string; score: number; maxScore: number; grade: string }>>([])
  const [reportMeta, setReportMeta] = useState<{ full_name?: string; class_name?: string; admission_number?: string } | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    studentId: '',
    subjectId: '',
    examId: '',
    score: '0',
    maxScore: '100',
  })

  async function refresh() {
    if (!profile?.organization_id) return
    try {
      const [markRows, master, insights] = await Promise.all([
        listMarks(profile.organization_id),
        listExamMasterData(profile.organization_id),
        getAcademicInsights(profile.organization_id),
      ])
      setMarks(markRows)
      setStudents(master.students)
      setSubjects(master.subjects)
      setExams(master.exams)
      setRanking(insights.ranking)
      setClassAverages(insights.classAverages)
      setForm((prev) => ({
        ...prev,
        studentId: prev.studentId || master.students[0]?.id || '',
        subjectId: prev.subjectId || master.subjects[0]?.id || '',
        examId: prev.examId || master.exams[0]?.id || '',
      }))
      if (!selectedStudentReport && master.students[0]?.id) setSelectedStudentReport(master.students[0].id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    refresh()
  }, [profile?.organization_id])

  async function submitMark() {
    if (!profile?.organization_id) return
    try {
      await createMark({
        organizationId: profile.organization_id,
        studentId: form.studentId,
        subjectId: form.subjectId,
        examId: form.examId,
        score: Number(form.score),
        maxScore: Number(form.maxScore),
      })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function generateReportCard() {
    if (!profile?.organization_id || !selectedStudentReport) return
    try {
      const card = await getStudentReportCard(profile.organization_id, selectedStudentReport)
      setReportAverage(card.average)
      setReportRows(card.rows)
      setReportMeta(card.student ?? null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const filteredMarks = marks.filter((mark) => {
    const q = search.toLowerCase()
    return (
      mark.studentName.toLowerCase().includes(q) ||
      mark.subjectName.toLowerCase().includes(q) ||
      mark.examName.toLowerCase().includes(q) ||
      mark.grade.toLowerCase().includes(q)
    )
  })

  const exportRows = filteredMarks.map((mark) => ({
    Student: mark.studentName,
    Subject: mark.subjectName,
    Exam: mark.examName,
    Score: `${mark.score}/${mark.maxScore}`,
    Grade: mark.grade,
  }))

  async function handleExport(type: 'csv' | 'xlsx' | 'print') {
    if (!profile?.organization_id) return
    if (type === 'csv') exportToCsv('marks.csv', exportRows)
    if (type === 'xlsx') exportToXlsx('marks.xlsx', exportRows)
    if (type === 'print') printRows('Academic Marks Register', exportRows)
    await logDataExport({
      organizationId: profile.organization_id,
      module: 'academics',
      exportType: type === 'print' ? 'print' : type,
      filters: { search },
    })
  }

  return (
    <section className="space-y-4">
      <ErpToolbar
        title="Academics & Marks"
        subtitle="Continuous assessment entry, UNEB-style grading, and report-ready marks sheets."
        search={search}
        onSearchChange={setSearch}
        onCsv={() => handleExport('csv')}
        onXlsx={() => handleExport('xlsx')}
        onPrint={() => handleExport('print')}
      />
      <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-6 dark:border-slate-800">
        <select value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          {students.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? 'Student'}</option>)}
        </select>
        <select value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))} className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name ?? 'Subject'}</option>)}
        </select>
        <select value={form.examId} onChange={(e) => setForm((f) => ({ ...f, examId: e.target.value }))} className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          {exams.map((e) => <option key={e.id} value={e.id}>{e.name ?? 'Exam'}</option>)}
        </select>
        <input value={form.score} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))} className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" placeholder="Score" />
        <input value={form.maxScore} onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))} className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" placeholder="Max score" />
        <button onClick={submitMark} className="rounded bg-emerald-600 px-2 py-2 text-xs font-medium text-white">Save Mark</button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {filteredMarks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700">
          No marks found for the selected tenant. <button onClick={refresh} className="underline">Retry</button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Subject</th>
              <th className="px-2 py-2">Exam</th>
              <th className="px-2 py-2">Score</th>
              <th className="px-2 py-2">Grade</th>
            </tr>
          </thead>
          <tbody>
            {filteredMarks.map((mark) => (
              <tr key={mark.id} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-2 py-2">{mark.studentName}</td>
                <td className="px-2 py-2">{mark.subjectName}</td>
                <td className="px-2 py-2">{mark.examName}</td>
                <td className="px-2 py-2">{mark.score}/{mark.maxScore}</td>
                <td className="px-2 py-2">{mark.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-2 text-base font-semibold">Class Averages</h3>
          {classAverages.length === 0 ? (
            <p className="text-sm text-slate-500">No class average data yet.</p>
          ) : (
            classAverages.map((c) => (
              <div key={c.className} className="mb-2 flex items-center justify-between text-sm">
                <span>{c.className}</span>
                <span className="font-semibold">{c.average.toFixed(1)}%</span>
              </div>
            ))
          )}
          <h3 className="mb-2 mt-4 text-base font-semibold">Top Ranking</h3>
          {ranking.slice(0, 5).map((r, idx) => (
            <div key={`${r.studentName}-${idx}`} className="mb-1 flex items-center justify-between text-sm">
              <span>{idx + 1}. {r.studentName}</span>
              <span>{r.average.toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-2 text-base font-semibold">Printable Report Card</h3>
          <div className="flex gap-2">
            <select value={selectedStudentReport} onChange={(e) => setSelectedStudentReport(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name ?? 'Student'}
                </option>
              ))}
            </select>
            <button onClick={generateReportCard} className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white">Generate</button>
          </div>
          {reportRows.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-500">
                {reportMeta?.full_name} ({reportMeta?.admission_number}) - {reportMeta?.class_name}
              </p>
              <p className="text-sm font-semibold">Average: {reportAverage.toFixed(1)}%</p>
              <button
                onClick={() =>
                  printRows('Student Report Card', reportRows.map((r) => ({
                    Subject: r.subject,
                    Exam: r.exam,
                    Score: `${r.score}/${r.maxScore}`,
                    Grade: r.grade,
                  })))
                }
                className="rounded border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700"
              >
                Print Report Card
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

