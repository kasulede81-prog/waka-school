import { useEffect, useState } from 'react'
import { listBackgroundJobs, markBackgroundJobDeadLetter, retryBackgroundJob } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'

export function JobsQueuePage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')

  async function load() {
    if (!profile?.organization_id) return
    try {
      const data = await listBackgroundJobs(profile.organization_id, 120)
      setRows(data)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [profile?.organization_id])

  return (
    <section className="space-y-4">
      <ErpToolbar
        title="Background jobs & DLQ"
        subtitle="Async workers for reports, SMS, receipts, reconciliation, and backups. Retry or dead-letter stuck jobs."
        search=""
        onSearchChange={() => {}}
        onCsv={() => {}}
        onXlsx={() => {}}
        onPrint={() => {}}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button type="button" onClick={() => void load()} className="rounded-md border px-3 py-1.5 text-xs dark:border-slate-600">
        Refresh
      </button>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
            <tr>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Cron / next</th>
              <th className="px-2 py-2">Attempts</th>
              <th className="px-2 py-2">DLQ</th>
              <th className="px-2 py-2">Last error</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-2 py-2 font-mono">{String(r.job_type)}</td>
                <td className="px-2 py-2">{String(r.status)}</td>
                <td className="max-w-[140px] truncate px-2 py-2 text-slate-600 dark:text-slate-400" title={String(r.scheduled_next_at ?? '')}>
                  {r.cron_expression ? String(r.cron_expression) : '—'}
                  {r.scheduled_next_at ? ` · ${String(r.scheduled_next_at).slice(0, 16)}` : ''}
                </td>
                <td className="px-2 py-2">
                  {String(r.attempts)}/{String(r.max_attempts)}
                </td>
                <td className="px-2 py-2">{r.dead_letter ? 'yes' : 'no'}</td>
                <td className="max-w-xs truncate px-2 py-2">{String(r.last_error ?? '—')}</td>
                <td className="space-x-1 px-2 py-2">
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-0.5 dark:border-slate-600"
                    onClick={() => {
                      void (async () => {
                        await retryBackgroundJob(String(r.id))
                        await load()
                      })()
                    }}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="rounded border border-amber-500 px-2 py-0.5 text-amber-800 dark:text-amber-300"
                    onClick={() => {
                      void (async () => {
                        await markBackgroundJobDeadLetter(String(r.id), 'operator_dlq')
                        await load()
                      })()
                    }}
                  >
                    DLQ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
