import { useEffect, useState } from 'react'
import {
  createApprovalRequest,
  createJournalEntry,
  ensureDefaultLedgerAccounts,
  fetchBalanceSheetSummary,
  fetchFeeAgingBuckets,
  fetchProfitAndLoss,
  fetchTrialBalance,
  listJournalEntries,
  listLedgerAccounts,
  logDataExport,
  type TrialBalanceRow,
} from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'
import { exportToCsv, exportToXlsx, printRows } from '../../lib/export-utils'

type Journal = {
  id: string
  entry_date: string
  reference: string | null
  description: string | null
  source: string | null
  entry_status: string | null
}

type Account = {
  id: string
  code: string
  name: string
  account_type: string
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function FinancePage() {
  const { permissions, profile } = useAuth()
  const [tab, setTab] = useState<'journals' | 'reports'>('journals')
  const [entries, setEntries] = useState<Journal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    reference: '',
    description: '',
    debitAccountId: '',
    creditAccountId: '',
    amount: '0',
  })

  const [dateFrom, setDateFrom] = useState(() => {
    const y = new Date().getFullYear()
    return `${y}-01-01`
  })
  const [dateTo, setDateTo] = useState(() => isoDate(new Date()))
  const [trial, setTrial] = useState<TrialBalanceRow[]>([])
  const [pl, setPl] = useState<{ section: string; amount: number }[]>([])
  const [bs, setBs] = useState<{ bucket: string; amount: number }[]>([])
  const [aging, setAging] = useState<{ bucket: string; outstanding: number }[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)

  const canPost = permissions.includes('finance.post_journal') || profile?.role === 'super_admin'
  const canViewReports =
    permissions.includes('finance.view_reports') || permissions.includes('finance.post_journal') || profile?.role === 'super_admin'

  async function refresh() {
    if (!profile?.organization_id) return
    try {
      const [entryRows, accountRows] = await Promise.all([
        listJournalEntries(profile.organization_id),
        listLedgerAccounts(profile.organization_id),
      ])
      setEntries(entryRows as Journal[])
      setAccounts(accountRows as Account[])
      setForm((prev) => ({
        ...prev,
        debitAccountId: prev.debitAccountId || accountRows[0]?.id || '',
        creditAccountId: prev.creditAccountId || accountRows[1]?.id || accountRows[0]?.id || '',
      }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    refresh()
  }, [profile?.organization_id])

  async function loadReports() {
    if (!profile?.organization_id || !canViewReports) return
    setReportsLoading(true)
    setError('')
    try {
      await ensureDefaultLedgerAccounts(profile.organization_id)
      const [tb, plRows, bsRows, ag] = await Promise.all([
        fetchTrialBalance(profile.organization_id, dateFrom, dateTo),
        fetchProfitAndLoss(profile.organization_id, dateFrom, dateTo),
        fetchBalanceSheetSummary(profile.organization_id, dateTo),
        fetchFeeAgingBuckets(profile.organization_id, dateTo),
      ])
      setTrial(tb)
      setPl(plRows)
      setBs(bsRows)
      setAging(ag)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setReportsLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'reports' && profile?.organization_id && canViewReports) {
      void loadReports()
    }
  }, [tab, profile?.organization_id, canViewReports, dateFrom, dateTo])

  async function postEntry() {
    if (!profile?.organization_id) return
    try {
      if (canPost) {
        await createJournalEntry({
          organizationId: profile.organization_id,
          reference: form.reference,
          description: form.description,
          debitAccountId: form.debitAccountId,
          creditAccountId: form.creditAccountId,
          amount: Number(form.amount),
        })
        setMessage('Journal entry posted.')
      } else {
        await createApprovalRequest({
          organizationId: profile.organization_id,
          module: 'finance',
          entityTable: 'journal_entries',
          requestType: 'post_journal',
          payload: {
            reference: form.reference,
            description: form.description,
            debitAccountId: form.debitAccountId,
            creditAccountId: form.creditAccountId,
            amount: Number(form.amount),
          },
        })
        setMessage('Journal posting submitted for approval.')
      }
      setForm((f) => ({ ...f, reference: '', description: '', amount: '0' }))
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const filteredEntries = entries.filter((entry) => {
    const q = search.toLowerCase()
    return (
      String(entry.reference ?? '').toLowerCase().includes(q) ||
      String(entry.description ?? '').toLowerCase().includes(q) ||
      String(entry.source ?? '').toLowerCase().includes(q) ||
      String(entry.entry_status ?? '').toLowerCase().includes(q) ||
      entry.entry_date.includes(q)
    )
  })

  const exportRows = filteredEntries.map((entry) => ({
    Date: entry.entry_date,
    Reference: entry.reference ?? '',
    Description: entry.description ?? '',
    Source: entry.source ?? '',
    Status: entry.entry_status ?? '',
  }))

  async function handleExport(type: 'csv' | 'xlsx' | 'print') {
    if (!profile?.organization_id) return
    if (type === 'csv') exportToCsv('ledger-journals.csv', exportRows)
    if (type === 'xlsx') exportToXlsx('ledger-journals.xlsx', exportRows)
    if (type === 'print') printRows('Ledger Journal Register', exportRows)
    await logDataExport({
      organizationId: profile.organization_id,
      module: 'finance',
      exportType: type === 'print' ? 'print' : type,
      filters: { search },
    })
  }

  function exportTrialCsv() {
    const rows = trial.map((r) => ({
      Code: r.account_code,
      Name: r.account_name,
      Type: r.account_type,
      Debit: r.debit_total,
      Credit: r.credit_total,
      Net: r.net_balance,
    }))
    exportToCsv(`trial-balance-${dateFrom}-${dateTo}.csv`, rows)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab('journals')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'journals' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
        >
          Journals
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          disabled={!canViewReports}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'reports' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'} disabled:opacity-40`}
        >
          Reports
        </button>
      </div>

      {tab === 'journals' ? (
        <>
          <ErpToolbar
            title="Finance Ledger"
            subtitle="Double-entry posting, immutable posted journals, and approval-backed controls."
            search={search}
            onSearchChange={setSearch}
            onCsv={() => handleExport('csv')}
            onXlsx={() => handleExport('xlsx')}
            onPrint={() => handleExport('print')}
          />
          <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-6 dark:border-slate-800">
            <input
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              placeholder="Reference"
            />
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              placeholder="Description"
            />
            <select
              value={form.debitAccountId}
              onChange={(e) => setForm((f) => ({ ...f, debitAccountId: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  DR {a.code} - {a.name}
                </option>
              ))}
            </select>
            <select
              value={form.creditAccountId}
              onChange={(e) => setForm((f) => ({ ...f, creditAccountId: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  CR {a.code} - {a.name}
                </option>
              ))}
            </select>
            <input
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              placeholder="Amount"
            />
            <button onClick={postEntry} className="rounded bg-emerald-600 px-2 py-2 text-xs font-medium text-white">
              Post Entry
            </button>
          </div>
          {message ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="px-2 py-2">{entry.entry_date}</td>
                    <td className="px-2 py-2">{entry.reference ?? '-'}</td>
                    <td className="px-2 py-2">{entry.description ?? '-'}</td>
                    <td className="px-2 py-2">{entry.source ?? '-'}</td>
                    <td className="px-2 py-2">{entry.entry_status ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold">Financial statements</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Trial balance, P&amp;L, balance sheet snapshot, and fee aging — computed server-side from posted journals.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-600 dark:text-slate-400">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 block rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-400">
              To (also &quot;as of&quot; for balance sheet &amp; aging)
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 block rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadReports()}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs dark:border-slate-700"
            >
              Refresh
            </button>
            <button type="button" onClick={exportTrialCsv} className="rounded-md bg-slate-800 px-3 py-2 text-xs text-white dark:bg-slate-200 dark:text-slate-900">
              Export trial balance (CSV)
            </button>
          </div>
          {reportsLoading ? <p className="text-xs text-slate-500">Loading reports…</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold">Profit &amp; loss (period)</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {pl.map((row) => (
                  <li key={row.section} className="flex justify-between">
                    <span className="capitalize">{row.section}</span>
                    <span>{Number(row.amount).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold">Balance sheet (as of {dateTo})</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {bs.map((row) => (
                  <li key={row.bucket} className="flex justify-between">
                    <span className="capitalize">{row.bucket}</span>
                    <span>{Number(row.amount).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800 md:col-span-2">
              <h3 className="text-sm font-semibold">Fee aging (open invoices)</h3>
              <ul className="mt-2 flex flex-wrap gap-4 text-sm">
                {aging.map((row) => (
                  <li key={row.bucket}>
                    <span className="text-slate-500">{row.bucket.replaceAll('_', '–')} days · </span>
                    <span className="font-medium">{Number(row.outstanding).toLocaleString()} UGX</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Account</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2 text-right">Debit</th>
                  <th className="px-2 py-2 text-right">Credit</th>
                  <th className="px-2 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {trial.map((r) => (
                  <tr key={r.account_code} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="px-2 py-1 font-mono text-xs">{r.account_code}</td>
                    <td className="px-2 py-1">{r.account_name}</td>
                    <td className="px-2 py-1 capitalize">{r.account_type}</td>
                    <td className="px-2 py-1 text-right">{Number(r.debit_total).toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">{Number(r.credit_total).toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">{Number(r.net_balance).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
