import { useEffect, useMemo, useState } from 'react'
import {
  enqueueBackgroundJob,
  listPaymentWebhookEvents,
  listPaymentsForOps,
} from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'

export function ReconciliationCenterPage() {
  const { profile } = useAuth()
  const [hooks, setHooks] = useState<Array<Record<string, unknown>>>([])
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    if (!profile?.organization_id) return
    setError('')
    try {
      const [h, p] = await Promise.all([
        listPaymentWebhookEvents(profile.organization_id, 100),
        listPaymentsForOps(profile.organization_id, undefined, 200),
      ])
      setHooks(h)
      setPayments(p)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [profile?.organization_id])

  const duplicateRefs = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of payments) {
      const ref = String(row.transaction_ref ?? '')
      if (!ref) continue
      map.set(ref, (map.get(ref) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
  }, [payments])

  const pending = useMemo(() => payments.filter((p) => p.status === 'pending'), [payments])

  async function queueRetryWebhookProcessing() {
    if (!profile?.organization_id) return
    try {
      await enqueueBackgroundJob({
        organizationId: profile.organization_id,
        jobType: 'reconciliation.retry_webhooks',
        payload: { triggeredBy: profile.id },
      })
      setMsg('Reconciliation worker job queued (configure worker to consume background_jobs).')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <ErpToolbar
        title="Mobile money reconciliation center"
        subtitle="Webhook payloads, pending settlements, duplicate transaction references, and operator retry hooks."
        search=""
        onSearchChange={() => {}}
        onCsv={() => {}}
        onXlsx={() => {}}
        onPrint={() => {}}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void load()} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-600">
          Refresh
        </button>
        <button type="button" onClick={() => void queueRetryWebhookProcessing()} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white">
          Queue reconciliation job
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <p className="text-xs uppercase text-slate-500">Pending payments</p>
          <p className="text-2xl font-bold">{pending.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <p className="text-xs uppercase text-slate-500">Webhook events (window)</p>
          <p className="text-2xl font-bold">{hooks.length}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs uppercase text-amber-800 dark:text-amber-300">Duplicate refs</p>
          <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">{duplicateRefs.length}</p>
        </div>
      </div>

      {duplicateRefs.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Potential duplicate transaction references</p>
          <ul className="mt-2 list-inside list-disc">
            {duplicateRefs.slice(0, 12).map(([ref, n]) => (
              <li key={ref}>
                {ref} — {n} rows
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/80">Recent webhook payloads</h3>
          <table className="min-w-full text-left text-xs">
            <thead className="border-b dark:border-slate-800">
              <tr>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Provider</th>
                <th className="px-2 py-2">Verified</th>
                <th className="px-2 py-2">Ref</th>
              </tr>
            </thead>
            <tbody>
              {hooks.map((h) => (
                <tr key={String(h.id)} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-2 py-2">{new Date(String(h.created_at)).toLocaleString()}</td>
                  <td className="px-2 py-2">{String(h.provider)}</td>
                  <td className="px-2 py-2">{h.verified ? 'yes' : 'no'}</td>
                  <td className="px-2 py-2 font-mono">{String(h.transaction_ref ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!hooks.length ? <p className="p-3 text-slate-500">No webhook rows for this school (populate via Edge Function).</p> : null}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/80">Payment timeline</h3>
          <table className="min-w-full text-left text-xs">
            <thead className="border-b dark:border-slate-800">
              <tr>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Method</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Webhook</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={String(p.id)} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-2 py-2">{new Date(String(p.created_at)).toLocaleString()}</td>
                  <td className="px-2 py-2">{String(p.status)}</td>
                  <td className="px-2 py-2">{String(p.method)}</td>
                  <td className="px-2 py-2">{String(p.amount)}</td>
                  <td className="px-2 py-2">{p.webhook_verified ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
