import { useEffect, useState } from 'react'
import { listApprovalRequests, reviewApprovalRequest } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'

type ApprovalRow = {
  id: string
  module: string
  entity_table: string
  request_type: string
  status: 'pending' | 'approved' | 'rejected'
  payload: Record<string, unknown>
  comments: string | null
  created_at: string
}

export function ApprovalsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ApprovalRow[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reviewComment, setReviewComment] = useState('')

  async function refresh() {
    if (!profile?.organization_id) return
    try {
      const data = await listApprovalRequests(profile.organization_id, 'pending')
      setRows(data as ApprovalRow[])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    refresh()
  }, [profile?.organization_id])

  async function decide(requestId: string, decision: 'approved' | 'rejected') {
    if (!profile?.organization_id) return
    try {
      await reviewApprovalRequest({
        organizationId: profile.organization_id,
        requestId,
        decision,
        comments: reviewComment.trim() || undefined,
      })
      setMessage(`Request ${decision}.`)
      setReviewComment('')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Approval Workbench</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Central review queue for controlled ERP actions such as financial postings and sensitive updates.
        </p>
      </div>
      {message ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <label className="block text-xs font-medium text-slate-500">Reviewer comment (optional, applied to next decision)</label>
      <textarea
        value={reviewComment}
        onChange={(e) => setReviewComment(e.target.value)}
        className="mt-1 w-full max-w-xl rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
        rows={2}
      />
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Module</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Payload</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{row.module}</td>
                <td className="px-3 py-2">{row.request_type}</td>
                <td className="px-3 py-2 text-xs">{JSON.stringify(row.payload)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => decide(row.id, 'approved')} className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white">
                      Approve
                    </button>
                    <button onClick={() => decide(row.id, 'rejected')} className="rounded-md bg-red-600 px-2 py-1 text-xs text-white">
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

