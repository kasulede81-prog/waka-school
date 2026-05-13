import { useEffect, useState } from 'react'
import { enqueueBackgroundJob, enqueueMessageOutbox, listMessageOutbox } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'

export function CommunicationsHubPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [channel, setChannel] = useState<'sms' | 'whatsapp' | 'email'>('sms')
  const [recipient, setRecipient] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    if (!profile?.organization_id) return
    try {
      const data = await listMessageOutbox(profile.organization_id, 100)
      setRows(data)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [profile?.organization_id])

  async function sendQueued() {
    if (!profile?.organization_id || !recipient.trim() || !body.trim()) return
    setError('')
    setMsg('')
    try {
      await enqueueMessageOutbox({
        organizationId: profile.organization_id,
        channel: channel === 'whatsapp' ? 'whatsapp' : channel === 'email' ? 'email' : 'sms',
        recipient: recipient.trim(),
        body: body.trim(),
      })
      await enqueueBackgroundJob({
        organizationId: profile.organization_id,
        jobType: 'communications.dispatch',
        payload: { channel },
      })
      setMsg('Message staged in outbox and dispatch job queued.')
      setRecipient('')
      setBody('')
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <ErpToolbar
        title="Communications hub"
        subtitle="Bulk-ready SMS / WhatsApp layer with delivery logs. Connect provider credentials in Supabase Edge Functions."
        search=""
        onSearchChange={() => {}}
        onCsv={() => {}}
        onXlsx={() => {}}
        onPrint={() => {}}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
      <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-2 dark:border-slate-800">
        <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className="rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp (ready)</option>
          <option value="email">Email</option>
        </select>
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="MSISDN or email" className="rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body" className="md:col-span-2 min-h-[80px] rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        <button type="button" onClick={() => void sendQueued()} className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white md:col-span-2">
          Stage message + queue worker
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
            <tr>
              <th className="px-2 py-2">Created</th>
              <th className="px-2 py-2">Channel</th>
              <th className="px-2 py-2">Recipient</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100 dark:border-slate-900">
                <td className="px-2 py-2">{new Date(String(r.created_at)).toLocaleString()}</td>
                <td className="px-2 py-2">{String(r.channel)}</td>
                <td className="px-2 py-2">{String(r.recipient)}</td>
                <td className="px-2 py-2">{String(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
