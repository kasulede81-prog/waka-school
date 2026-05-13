import { useEffect, useState } from 'react'
import { listOrganizationsWithSubscriptions } from '../../lib/data-service'

export function SaasOverviewPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function run() {
      try {
        setRows(await listOrganizationsWithSubscriptions())
      } catch (e) {
        setError((e as Error).message)
      }
    }
    void run()
  }, [])

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">SaaS & school fleet</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Subscription posture, trial risk, and tenant inventory for platform operators.</p>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
            <tr>
              <th className="px-2 py-2">School</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Academic year</th>
              <th className="px-2 py-2">Subscription</th>
              <th className="px-2 py-2">Ends</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const sub = o.subscription as Record<string, unknown> | null
              return (
                <tr key={String(o.id)} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-2 py-2 font-medium">{String(o.name)}</td>
                  <td className="px-2 py-2">{String(o.school_type)}</td>
                  <td className="px-2 py-2">{String(o.active_academic_year)}</td>
                  <td className="px-2 py-2">{sub ? String(sub.status) : '—'}</td>
                  <td className="px-2 py-2">{sub?.ends_at ? new Date(String(sub.ends_at)).toLocaleDateString() : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
