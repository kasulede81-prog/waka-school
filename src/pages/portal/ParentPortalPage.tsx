import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { initiateMobileMoneyPayment, listAnnouncements, listInvoiceBalances, listStudents } from '../../lib/data-service'
import type { FeeBalance } from '../../types'
import type { Student } from '../../types'

const UGX = new Intl.NumberFormat('en-UG')

export function ParentPortalPage() {
  const { profile } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [balances, setBalances] = useState<FeeBalance[]>([])
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; body: string; channel: string; created_at: string }>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!profile?.organization_id) return
      try {
        const [sRows, balRows, ann] = await Promise.all([
          listStudents(profile.organization_id),
          listInvoiceBalances(profile.organization_id),
          listAnnouncements(profile.organization_id, 15),
        ])
        setStudents(sRows)
        setBalances(balRows)
        setAnnouncements(ann as typeof announcements)
      } catch (e) {
        setError((e as Error).message)
      }
    }
    load()
  }, [profile?.organization_id])

  function balanceForStudent(studentId: string) {
    return balances.filter((b) => b.studentId === studentId)
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Parent portal</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Linked children, fee balances, announcements, and deep links into attendance and academics. Guardians are auto-linked when your phone matches the student record.
        </p>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Your children</h3>
        {!students.length ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
            No linked students yet. Ensure your profile phone matches the parent phone on the student card, or ask the school registrar to link your account.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {students.map((s) => {
              const inv = balanceForStudent(s.id)
              const totalOut = inv.reduce((a, b) => a + b.balance, 0)
              return (
                <article key={s.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-lg font-semibold">{s.fullName}</h4>
                      <p className="text-xs text-slate-500">
                        {s.className} {s.stream} · {s.admissionNumber}
                      </p>
                    </div>
                    <Link to={`/portal/student/${s.id}`} className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">
                      Full profile
                    </Link>
                  </div>
                  <p className="mt-2 text-sm">
                    Outstanding: <strong className="text-amber-700 dark:text-amber-400">UGX {UGX.format(totalOut)}</strong>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inv.map((item) => (
                      <div key={item.invoiceId ?? 'x'} className="text-xs text-slate-600 dark:text-slate-400">
                        Due {item.dueDate}: UGX {UGX.format(item.balance)}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white"
                      onClick={async () => {
                        const first = inv[0]
                        if (!profile?.organization_id || !first?.invoiceId) return
                        try {
                          await initiateMobileMoneyPayment({
                            organizationId: profile.organization_id,
                            invoiceId: first.invoiceId,
                            studentId: s.id,
                            phoneNumber: profile.phone ?? '',
                            amount: Math.min(first.balance, 50000),
                            provider: 'mtn_momo',
                          })
                        } catch (e) {
                          setError((e as Error).message)
                        }
                      }}
                    >
                      Pay MTN MoMo
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white"
                      onClick={async () => {
                        const first = inv[0]
                        if (!profile?.organization_id || !first?.invoiceId) return
                        try {
                          await initiateMobileMoneyPayment({
                            organizationId: profile.organization_id,
                            invoiceId: first.invoiceId,
                            studentId: s.id,
                            phoneNumber: profile.phone ?? '',
                            amount: Math.min(first.balance, 50000),
                            provider: 'airtel_money',
                          })
                        } catch (e) {
                          setError((e as Error).message)
                        }
                      }}
                    >
                      Pay Airtel
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400">WhatsApp alerts: pipeline-ready (SMS channel live where configured).</p>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">School announcements</h3>
        <ul className="space-y-2">
          {announcements.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-medium">{a.title}</p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{a.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {a.channel} · {new Date(a.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
        {!announcements.length ? <p className="text-xs text-slate-500">No announcements.</p> : null}
      </div>
    </section>
  )
}
