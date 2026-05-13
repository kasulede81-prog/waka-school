import { useEffect, useState } from 'react'
import { listTransportRoutes } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'

export function TransportOpsPage() {
  const { profile } = useAuth()
  const [routes, setRoutes] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function run() {
      if (!profile?.organization_id) return
      try {
        setRoutes((await listTransportRoutes(profile.organization_id)) as typeof routes)
      } catch (e) {
        setError((e as Error).message)
      }
    }
    void run()
  }, [profile?.organization_id])

  return (
    <section className="space-y-4">
      <ErpToolbar title="Transport operations" subtitle="Routes, drivers, plates, and pickup logistics." search="" onSearchChange={() => {}} onCsv={() => {}} onXlsx={() => {}} onPrint={() => {}} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
            <tr>
              <th className="px-2 py-2">Route</th>
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Driver</th>
              <th className="px-2 py-2">Vehicle</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-2 py-2">{String(r.name)}</td>
                <td className="px-2 py-2">{String(r.code ?? '—')}</td>
                <td className="px-2 py-2">{String(r.driver_name ?? '—')}</td>
                <td className="px-2 py-2">{String(r.vehicle_plate ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
