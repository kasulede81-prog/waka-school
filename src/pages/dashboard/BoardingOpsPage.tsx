import { useEffect, useState } from 'react'
import { listBedAssignments, listDormitoriesSummary } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'

export function BoardingOpsPage() {
  const { profile } = useAuth()
  const [dorms, setDorms] = useState<Array<Record<string, unknown>>>([])
  const [beds, setBeds] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function run() {
      if (!profile?.organization_id) return
      try {
        const [d, b] = await Promise.all([
          listDormitoriesSummary(profile.organization_id),
          listBedAssignments(profile.organization_id, 150),
        ])
        setDorms(d as typeof dorms)
        setBeds(b as typeof beds)
      } catch (e) {
        setError((e as Error).message)
      }
    }
    void run()
  }, [profile?.organization_id])

  return (
    <section className="space-y-4">
      <ErpToolbar title="Boarding operations" subtitle="Dorm capacity model and recent bed assignments." search="" onSearchChange={() => {}} onCsv={() => {}} onXlsx={() => {}} onPrint={() => {}} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        {dorms.map((d) => (
          <div key={String(d.id)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <p className="font-semibold">{String(d.name)}</p>
            <p className="text-xs text-slate-500">Capacity {String(d.capacity)} · {String(d.gender ?? 'mixed')}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
            <tr>
              <th className="px-2 py-2">Dorm</th>
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Bed</th>
              <th className="px-2 py-2">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {beds.map((b) => (
              <tr key={String(b.id)} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-2 py-2">
                  {(() => {
                    const d = b.dormitories as { name?: string } | { name?: string }[] | null | undefined
                    if (!d) return '—'
                    return Array.isArray(d) ? d[0]?.name ?? '—' : d.name ?? '—'
                  })()}
                </td>
                <td className="px-2 py-2">
                  {(() => {
                    const s = b.students as { full_name?: string } | { full_name?: string }[] | null | undefined
                    if (!s) return '—'
                    return Array.isArray(s) ? s[0]?.full_name ?? '—' : s.full_name ?? '—'
                  })()}
                </td>
                <td className="px-2 py-2">{String(b.bed_label)}</td>
                <td className="px-2 py-2">{String(b.assigned_on)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
