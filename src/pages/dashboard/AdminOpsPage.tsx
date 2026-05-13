import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { listAuditLogs, listFinancePostingAudit, seedDemoDataForOrganization } from '../../lib/data-service'

type AuditRow = {
  id: string
  action: string
  created_at: string
  metadata: Record<string, unknown>
}

type FinanceAuditRow = {
  id: string
  journal_entry_id: string | null
  event_kind: string
  payload: Record<string, unknown>
  actor_id: string | null
  created_at: string
}

export function AdminOpsPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<'general' | 'finance'>('general')
  const [rows, setRows] = useState<AuditRow[]>([])
  const [financeRows, setFinanceRows] = useState<FinanceAuditRow[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadLogs() {
    if (!profile?.organization_id) return
    setLoading(true)
    setError('')
    try {
      const data = await listAuditLogs(profile.organization_id, 200)
      setRows(data as AuditRow[])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadFinanceAudit() {
    if (!profile?.organization_id) return
    setLoading(true)
    setError('')
    try {
      const data = await listFinancePostingAudit(profile.organization_id, 200)
      setFinanceRows(data as FinanceAuditRow[])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'general') loadLogs()
    else loadFinanceAudit()
  }, [profile?.organization_id, tab])

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Admin Operations</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Operational audit trails: general data changes and immutable finance posting history.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab('general')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === 'general' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
        >
          General audit
        </button>
        <button
          type="button"
          onClick={() => setTab('finance')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === 'finance' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
        >
          Finance postings
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={async () => {
            if (!profile?.organization_id) return
            try {
              const result = await seedDemoDataForOrganization(profile.organization_id)
              setMessage(`Demo data seeded: ${JSON.stringify(result)}`)
            } catch (e) {
              setError((e as Error).message)
            }
          }}
          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
        >
          Seed Demo Data
        </button>
        <button
          onClick={() => (tab === 'general' ? loadLogs() : loadFinanceAudit())}
          className="rounded-md border border-slate-300 px-3 py-2 text-xs dark:border-slate-700"
        >
          Retry load
        </button>
      </div>
      {message ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {loading ? <p className="text-xs text-slate-500">Loading…</p> : null}

      {tab === 'general' ? (
        <>
          {!loading && rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
              No audit events yet. Run operations or seed data first.
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{JSON.stringify(row.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {!loading && financeRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
              No finance posting events yet. Post journals, invoices, or payments after applying the wave-5 migration.
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Journal</th>
                  <th className="px-3 py-2">Payload</th>
                </tr>
              </thead>
              <tbody>
                {financeRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{row.event_kind}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.journal_entry_id ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{JSON.stringify(row.payload)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
