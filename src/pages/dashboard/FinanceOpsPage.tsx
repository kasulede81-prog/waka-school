import { useEffect, useMemo, useState } from 'react'
import {
  closeCashierSession,
  createBankStatementLine,
  listBankStatementLines,
  listCashierSessions,
  listUnmatchedPayments,
  openCashierSession,
  reconcilePayment,
} from '../../lib/data-service'
import { useAuth } from '../../lib/auth'

type CashierSession = {
  id: string
  opened_at: string
  closed_at: string | null
  opening_balance: number
  closing_balance: number | null
  expected_balance: number | null
  variance: number | null
  status: 'open' | 'closed'
}

type Payment = {
  id: string
  transaction_ref: string | null
  amount: number
  method: string
  created_at: string
}

type StatementLine = {
  id: string
  statement_date: string
  reference: string
  narration: string | null
  amount: number
  direction: 'credit' | 'debit'
  matched: boolean
}

export function FinanceOpsPage() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState<CashierSession[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [lines, setLines] = useState<StatementLine[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [closingBalance, setClosingBalance] = useState('0')
  const [expectedBalance, setExpectedBalance] = useState('0')
  const [statementForm, setStatementForm] = useState({
    statementDate: new Date().toISOString().slice(0, 10),
    reference: '',
    narration: '',
    amount: '0',
    direction: 'credit' as 'credit' | 'debit',
  })
  const [selectedPaymentId, setSelectedPaymentId] = useState('')
  const [selectedLineId, setSelectedLineId] = useState('')

  async function refresh() {
    if (!profile?.organization_id) return
    try {
      const [s, p, l] = await Promise.all([
        listCashierSessions(profile.organization_id),
        listUnmatchedPayments(profile.organization_id),
        listBankStatementLines(profile.organization_id),
      ])
      setSessions(s as CashierSession[])
      setPayments(p as Payment[])
      setLines(l as StatementLine[])
      if (!selectedPaymentId && p.length) setSelectedPaymentId((p[0] as Payment).id)
      const unmatchedLines = (l as StatementLine[]).filter((line) => !line.matched)
      if (!selectedLineId && unmatchedLines.length) setSelectedLineId(unmatchedLines[0].id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    refresh()
  }, [profile?.organization_id])

  const openSession = useMemo(() => sessions.find((s) => s.status === 'open'), [sessions])

  async function handleOpenSession() {
    if (!profile?.organization_id) return
    try {
      await openCashierSession({ organizationId: profile.organization_id, openingBalance: Number(openingBalance) })
      setMessage('Cashier session opened.')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleCloseSession() {
    if (!profile?.organization_id || !openSession) return
    try {
      await closeCashierSession({
        organizationId: profile.organization_id,
        sessionId: openSession.id,
        closingBalance: Number(closingBalance),
        expectedBalance: Number(expectedBalance),
      })
      setMessage('Cashier session closed.')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleAddStatementLine() {
    if (!profile?.organization_id) return
    try {
      await createBankStatementLine({
        organizationId: profile.organization_id,
        statementDate: statementForm.statementDate,
        reference: statementForm.reference,
        narration: statementForm.narration,
        amount: Number(statementForm.amount),
        direction: statementForm.direction,
      })
      setMessage('Bank statement line added.')
      setStatementForm((f) => ({ ...f, reference: '', narration: '', amount: '0' }))
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleReconcile() {
    if (!profile?.organization_id || !selectedPaymentId || !selectedLineId) return
    try {
      await reconcilePayment({
        organizationId: profile.organization_id,
        paymentId: selectedPaymentId,
        statementLineId: selectedLineId,
      })
      setMessage('Reconciliation match created.')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Finance Operations</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cashier session management and payment-to-bank reconciliation controls.
        </p>
      </div>
      {message ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-4 dark:border-slate-800">
        <input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="Opening balance" className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <button disabled={Boolean(openSession)} onClick={handleOpenSession} className="rounded bg-emerald-600 px-3 py-2 text-xs text-white disabled:opacity-50">
          Open Session
        </button>
        <input value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} placeholder="Closing balance" className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <div className="flex gap-2">
          <input value={expectedBalance} onChange={(e) => setExpectedBalance(e.target.value)} placeholder="Expected balance" className="w-full rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
          <button disabled={!openSession} onClick={handleCloseSession} className="rounded bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">
            Close
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-6 dark:border-slate-800">
        <input type="date" value={statementForm.statementDate} onChange={(e) => setStatementForm((f) => ({ ...f, statementDate: e.target.value }))} className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <input value={statementForm.reference} onChange={(e) => setStatementForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Bank ref" className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <input value={statementForm.narration} onChange={(e) => setStatementForm((f) => ({ ...f, narration: e.target.value }))} placeholder="Narration" className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <input value={statementForm.amount} onChange={(e) => setStatementForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount" className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
        <select value={statementForm.direction} onChange={(e) => setStatementForm((f) => ({ ...f, direction: e.target.value as 'credit' | 'debit' }))} className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <button onClick={handleAddStatementLine} className="rounded bg-blue-600 px-3 py-2 text-xs text-white">Add Statement Line</button>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-3 dark:border-slate-800">
        <select value={selectedPaymentId} onChange={(e) => setSelectedPaymentId(e.target.value)} className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          {payments.map((payment) => (
            <option key={payment.id} value={payment.id}>
              {payment.transaction_ref ?? payment.id} | {payment.amount}
            </option>
          ))}
        </select>
        <select value={selectedLineId} onChange={(e) => setSelectedLineId(e.target.value)} className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          {lines.filter((line) => !line.matched).map((line) => (
            <option key={line.id} value={line.id}>
              {line.reference} | {line.amount} | {line.statement_date}
            </option>
          ))}
        </select>
        <button onClick={handleReconcile} className="rounded bg-indigo-600 px-3 py-2 text-xs text-white">Create Match</button>
      </div>
    </section>
  )
}

