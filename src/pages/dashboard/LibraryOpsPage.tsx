import { useEffect, useState } from 'react'
import { listLibraryLoans } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'

export function LibraryOpsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function run() {
      if (!profile?.organization_id) return
      try {
        setRows((await listLibraryLoans(profile.organization_id, 120)) as typeof rows)
      } catch (e) {
        setError((e as Error).message)
      }
    }
    void run()
  }, [profile?.organization_id])

  return (
    <section className="space-y-4">
      <ErpToolbar title="Library operations" subtitle="Loan queue sorted by due date — fines and returns in ERP finance." search="" onSearchChange={() => {}} onCsv={() => {}} onXlsx={() => {}} onPrint={() => {}} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
            <tr>
              <th className="px-2 py-2">Due</th>
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Returned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-2 py-2">{new Date(String(r.due_at)).toLocaleDateString()}</td>
                <td className="px-2 py-2">
                  {(() => {
                    const b = r.library_books as { title?: string } | { title?: string }[] | null | undefined
                    if (!b) return '—'
                    return Array.isArray(b) ? b[0]?.title ?? '—' : b.title ?? '—'
                  })()}
                </td>
                <td className="px-2 py-2">
                  {(() => {
                    const s = r.students as { full_name?: string } | { full_name?: string }[] | null | undefined
                    if (!s) return '—'
                    return Array.isArray(s) ? s[0]?.full_name ?? '—' : s.full_name ?? '—'
                  })()}
                </td>
                <td className="px-2 py-2">{r.returned_at ? new Date(String(r.returned_at)).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
