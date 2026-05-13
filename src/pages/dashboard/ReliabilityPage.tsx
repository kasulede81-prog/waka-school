import { useEffect, useState } from 'react'
import { listArchivalRuns, listBackupRuns, queueArchivalRun, queueBackupRun } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'

type RunRow = {
  id: string
  module?: string
  backup_scope?: string
  status: string
  archived_rows?: number
  started_at?: string | null
  finished_at?: string | null
  error?: string | null
  created_at: string
}

export function ReliabilityPage() {
  const { profile } = useAuth()
  const [archivalRuns, setArchivalRuns] = useState<RunRow[]>([])
  const [backupRuns, setBackupRuns] = useState<RunRow[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [moduleName, setModuleName] = useState('attendance')

  async function refresh() {
    if (!profile?.organization_id) return
    try {
      const [a, b] = await Promise.all([listArchivalRuns(profile.organization_id), listBackupRuns(profile.organization_id)])
      setArchivalRuns(a as RunRow[])
      setBackupRuns(b as RunRow[])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    refresh()
  }, [profile?.organization_id])

  async function queueArchival() {
    if (!profile?.organization_id) return
    try {
      await queueArchivalRun({ organizationId: profile.organization_id, module: moduleName })
      setMessage('Archival run queued.')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function queueBackup() {
    if (!profile?.organization_id) return
    try {
      await queueBackupRun({ organizationId: profile.organization_id, backupScope: 'tenant' })
      setMessage('Backup run queued.')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Reliability & Recovery</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Operational controls for archival jobs and backup lifecycle tracking.</p>
      </div>
      {message ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <input value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="Module (e.g. attendance)" className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <button onClick={queueArchival} className="rounded bg-slate-900 px-3 py-2 text-xs text-white dark:bg-slate-100 dark:text-slate-900">Queue Archival</button>
        <button onClick={queueBackup} className="rounded bg-indigo-600 px-3 py-2 text-xs text-white">Queue Tenant Backup</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr><th className="px-3 py-2">Archival</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Created</th></tr>
            </thead>
            <tbody>
              {archivalRuns.map((run) => (
                <tr key={run.id} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-3 py-2">{run.module}</td>
                  <td className="px-3 py-2">{run.status}</td>
                  <td className="px-3 py-2">{new Date(run.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr><th className="px-3 py-2">Backup Scope</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Created</th></tr>
            </thead>
            <tbody>
              {backupRuns.map((run) => (
                <tr key={run.id} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-3 py-2">{run.backup_scope}</td>
                  <td className="px-3 py-2">{run.status}</td>
                  <td className="px-3 py-2">{new Date(run.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

