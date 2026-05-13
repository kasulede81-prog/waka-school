import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { getAcademicInsights, getDashboardSummary, listApprovalRequests, listRecentPayments } from '../../lib/data-service'
import { getRoleDashboard } from '../../config/role-dashboard'

const UGX = new Intl.NumberFormat('en-UG')

export function DashboardPage() {
  const { profile, permissions } = useAuth()
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState<Array<{ title: string; value: string; delta: string }>>([])
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [topPerformers, setTopPerformers] = useState<Array<{ studentName: string; className: string; average: number }>>([])
  const [recentPayments, setRecentPayments] = useState<Array<{ id: string; amount: number; method: string; status: string; created_at: string }>>([])
  const [error, setError] = useState('')

  const blueprint = getRoleDashboard(profile?.role)

  async function loadDashboard() {
    const bp = getRoleDashboard(profile?.role)
    if (!profile?.organization_id) {
      setMetrics(
        bp.kpis.map((k) => ({
          title: k.label,
          value: '—',
          delta: 'Link a school organization to load KPIs',
        })),
      )
      setPendingApprovals(0)
      setTopPerformers([])
      setRecentPayments([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [summary, academics, payments, approvals] = await Promise.all([
        getDashboardSummary(profile.organization_id),
        getAcademicInsights(profile.organization_id),
        listRecentPayments(profile.organization_id),
        permissions.includes('admin.approvals.review') || profile.role === 'super_admin'
          ? listApprovalRequests(profile.organization_id, 'pending')
          : Promise.resolve([]),
      ])
      const valueMap: Record<string, string> = {
        students: String(summary.activeStudents),
        fees: UGX.format(summary.feesCollected),
        outstanding: UGX.format(summary.outstandingBalance),
        attendance: `${summary.attendanceToday.toFixed(1)}%`,
      }
      setMetrics(
        bp.kpis.map((k) => ({
          title: k.label,
          value: valueMap[k.valueKey] ?? '—',
          delta: 'Live tenant metrics',
        })),
      )
      setPendingApprovals(Array.isArray(approvals) ? approvals.length : 0)
      setTopPerformers(
        (academics.topPerformers ?? []).map((row) => ({
          studentName: row.studentName,
          className: row.className,
          average: row.average,
        })),
      )
      setRecentPayments(
        (payments as Array<{ id: string; amount: number; method: string; status: string; created_at: string }>) ?? [],
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [profile?.organization_id, profile?.role, permissions.join('|')])

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{blueprint.headline}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{blueprint.subline}</p>
        <p className="mt-2 text-xs text-slate-400">Role: {profile?.role?.replaceAll('_', ' ') ?? '—'} · Modules: {blueprint.modules.join(', ')}</p>
      </div>
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
          <button type="button" onClick={loadDashboard} className="ml-2 underline">
            Retry
          </button>
        </div>
      ) : null}
      {loading ? <p className="text-sm text-slate-500">Loading analytics...</p> : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.title} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{metric.title}</p>
            <h3 className="mt-2 text-2xl font-bold">{metric.value}</h3>
            {metric.delta ? <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{metric.delta}</p> : null}
          </article>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Tasks & approvals</h3>
          {pendingApprovals > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              {pendingApprovals} pending
            </span>
          ) : null}
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {blueprint.tasks.map((task) => (
            <li key={task.href}>
              <Link
                to={task.href}
                className={`inline-flex items-center gap-2 rounded-md px-2 py-1 ${
                  task.tone === 'urgent' ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'text-emerald-700 hover:underline dark:text-emerald-400'
                }`}
              >
                {task.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-base font-semibold">Uganda-first operational checklist</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>Configure UNEB / UCE / UACE grading scales and weighting.</li>
          <li>Run MoMo reconciliation center after each collection window.</li>
          <li>Keep finance adjustments (waivers, scholarships) in pending until approved.</li>
          <li>Monitor background jobs for SMS, PDF, and archival workers.</li>
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-2 text-base font-semibold">Top performers</h3>
          {topPerformers.length === 0 ? (
            <p className="text-sm text-slate-500">No marks data yet.</p>
          ) : (
            <div className="space-y-2">
              {topPerformers.slice(0, 5).map((row, index) => (
                <div key={`${row.studentName}-${index}`} className="grid grid-cols-[1fr_80px] items-center gap-3">
                  <div>
                    <p className="text-sm font-medium">{row.studentName}</p>
                    <p className="text-xs text-slate-500">{row.className}</p>
                  </div>
                  <div className="text-right text-sm font-semibold">{row.average.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-2 text-base font-semibold">Recent payments</h3>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-slate-500">No payment activity yet.</p>
          ) : (
            <div className="space-y-2">
              {recentPayments.slice(0, 6).map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto] items-center">
                  <div>
                    <p className="text-sm">{p.method}</p>
                    <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-sm font-semibold">UGX {UGX.format(p.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
