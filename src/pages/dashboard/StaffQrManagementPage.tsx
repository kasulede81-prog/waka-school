import { useEffect, useState } from 'react'
import { listTeachersWithQrTokens, rotateTeacherQrToken } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'

export function StaffQrManagementPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Array<{ id: string; full_name: string; secret_token: string }>>([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    if (!profile?.organization_id) return
    try {
      const data = await listTeachersWithQrTokens(profile.organization_id)
      setRows(data)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [profile?.organization_id])

  async function rotate(id: string) {
    setError('')
    setMsg('')
    try {
      await rotateTeacherQrToken(id)
      setMsg('QR secret rotated. Reprint ID cards with the new code.')
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <ErpToolbar
        title="Staff QR attendance"
        subtitle="Each staff member has a stable kiosk secret for QR check-in. Rotate after loss or compromise."
        search=""
        onSearchChange={() => {}}
        onCsv={() => {}}
        onXlsx={() => {}}
        onPrint={() => {}}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
            <tr>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Kiosk URL</th>
              <th className="px-3 py-2">QR</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/kiosk/staff?t=${r.secret_token}`
              const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`
              return (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-3 py-2 font-medium">{r.full_name}</td>
                  <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">{url}</td>
                  <td className="px-3 py-2">
                    {r.secret_token ? <img src={qrImg} alt="" width={120} height={120} className="rounded border border-slate-200 dark:border-slate-700" /> : <span className="text-xs text-amber-600">No token</span>}
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => void rotate(r.id)} className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600">
                      Rotate secret
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="text-sm text-slate-500">No teachers found for this organization.</p> : null}
    </section>
  )
}
