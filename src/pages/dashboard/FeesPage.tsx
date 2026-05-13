import { useEffect, useState } from 'react'
import {
  createFeeStructure,
  generateInvoicesFromFeeStructures,
  getFinanceSummary,
  initiateMobileMoneyPayment,
  listFeeStructures,
  listInvoiceBalances,
  logDataExport,
} from '../../lib/data-service'
import { useAuth } from '../../lib/auth'
import { ErpToolbar } from '../../components/ErpToolbar'
import { exportToCsv, exportToXlsx, printRows } from '../../lib/export-utils'
import type { FeeBalance } from '../../types'

const UGX = new Intl.NumberFormat('en-UG')

export function FeesPage() {
  const { profile } = useAuth()
  const [balances, setBalances] = useState<FeeBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [summary, setSummary] = useState({ invoiced: 0, paid: 0, outstanding: 0, paidInvoices: 0, pendingInvoices: 0, successfulPayments: 0 })
  const [feeStructures, setFeeStructures] = useState<Array<{ id: string; category: string; amount: number; academic_year: string; term: string }>>([])
  const [feeForm, setFeeForm] = useState({
    category: 'tuition',
    amount: '0',
    academicYear: String(new Date().getFullYear()),
    term: 'Term 1',
  })

  const feeCategoryOptions = [
    'tuition',
    'transport',
    'boarding',
    'meals',
    'uniforms',
    'uniform',
    'exams',
    'exam',
    'development',
    'library',
    'computer',
    'trips',
    'trip',
    'activity',
    'medical',
    'registration',
    'lunch',
    'uneb',
    'custom',
    'other',
  ]
  const [invoiceForm, setInvoiceForm] = useState({
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    academicYear: String(new Date().getFullYear()),
    term: 'Term 1',
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [data, finance, fees] = await Promise.all([
          listInvoiceBalances(profile?.organization_id),
          getFinanceSummary(profile?.organization_id),
          listFeeStructures(profile?.organization_id),
        ])
        setBalances(data)
        setSummary(finance)
        setFeeStructures(fees as Array<{ id: string; category: string; amount: number; academic_year: string; term: string }>)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile?.organization_id])

  return (
    <section className="space-y-4">
      <ErpToolbar
        title="Billing & Collections"
        subtitle="Invoice monitoring, mobile-money collection requests, and exportable debtors analysis."
        search={search}
        onSearchChange={setSearch}
        onCsv={async () => {
          const rows = balances
            .filter((item) => item.studentName.toLowerCase().includes(search.toLowerCase()))
            .map((item) => ({
              Student: item.studentName,
              DueDate: item.dueDate,
              Paid: item.paid,
              Balance: item.balance,
            }))
          exportToCsv('fee-balances.csv', rows)
          if (profile?.organization_id) {
            await logDataExport({ organizationId: profile.organization_id, module: 'fees', exportType: 'csv', filters: { search } })
          }
        }}
        onXlsx={async () => {
          const rows = balances
            .filter((item) => item.studentName.toLowerCase().includes(search.toLowerCase()))
            .map((item) => ({
              Student: item.studentName,
              DueDate: item.dueDate,
              Paid: item.paid,
              Balance: item.balance,
            }))
          exportToXlsx('fee-balances.xlsx', rows)
          if (profile?.organization_id) {
            await logDataExport({ organizationId: profile.organization_id, module: 'fees', exportType: 'xlsx', filters: { search } })
          }
        }}
        onPrint={async () => {
          const rows = balances
            .filter((item) => item.studentName.toLowerCase().includes(search.toLowerCase()))
            .map((item) => ({
              Student: item.studentName,
              DueDate: item.dueDate,
              Paid: item.paid,
              Balance: item.balance,
            }))
          printRows('Fees Balances', rows)
          if (profile?.organization_id) {
            await logDataExport({ organizationId: profile.organization_id, module: 'fees', exportType: 'print', filters: { search } })
          }
        }}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">Invoiced: <strong>UGX {UGX.format(summary.invoiced)}</strong></div>
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">Collected: <strong>UGX {UGX.format(summary.paid)}</strong></div>
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">Outstanding: <strong>UGX {UGX.format(summary.outstanding)}</strong></div>
      </div>
      <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-5 dark:border-slate-800">
        <select value={feeForm.category} onChange={(e) => setFeeForm((f) => ({ ...f, category: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
          {feeCategoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <input value={feeForm.amount} onChange={(e) => setFeeForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount" className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        <input value={feeForm.academicYear} onChange={(e) => setFeeForm((f) => ({ ...f, academicYear: e.target.value }))} placeholder="Academic Year" className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        <input value={feeForm.term} onChange={(e) => setFeeForm((f) => ({ ...f, term: e.target.value }))} placeholder="Term" className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        <button
          onClick={async () => {
            if (!profile?.organization_id) return
            try {
              await createFeeStructure({
                organizationId: profile.organization_id,
                category: feeForm.category,
                amount: Number(feeForm.amount),
                academicYear: feeForm.academicYear,
                term: feeForm.term,
              })
              setMessage('Fee structure saved.')
            } catch (e) {
              setError((e as Error).message)
            }
          }}
          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
        >
          Save Fee Structure
        </button>
      </div>
      <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-4 dark:border-slate-800">
        <input value={invoiceForm.academicYear} onChange={(e) => setInvoiceForm((f) => ({ ...f, academicYear: e.target.value }))} placeholder="Academic Year" className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        <input value={invoiceForm.term} onChange={(e) => setInvoiceForm((f) => ({ ...f, term: e.target.value }))} placeholder="Term" className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        <input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        <button
          onClick={async () => {
            if (!profile?.organization_id) return
            try {
              await generateInvoicesFromFeeStructures({
                organizationId: profile.organization_id,
                dueDate: invoiceForm.dueDate,
                academicYear: invoiceForm.academicYear,
                term: invoiceForm.term,
              })
              setMessage('Invoices generated from fee structures.')
            } catch (e) {
              setError((e as Error).message)
            }
          }}
          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white"
        >
          Generate Invoices
        </button>
      </div>
      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <h3 className="mb-2 text-sm font-semibold">Fee Structures</h3>
        {feeStructures.length === 0 ? (
          <p className="text-xs text-slate-500">No fee structures defined.</p>
        ) : (
          <div className="grid gap-1 text-xs">
            {feeStructures.slice(0, 10).map((f) => (
              <div key={f.id} className="grid grid-cols-4 gap-2">
                <span>{f.category}</span>
                <span>UGX {UGX.format(f.amount)}</span>
                <span>{f.academic_year}</span>
                <span>{f.term}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {message ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {loading ? <p className="text-xs text-slate-500">Loading balances...</p> : null}
      {!loading && balances.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
          No invoices available. Generate invoices after defining fee structures.
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {balances.filter((item) => item.studentName.toLowerCase().includes(search.toLowerCase())).map((item) => (
          <article key={item.studentName} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="font-semibold">{item.studentName}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Due by {item.dueDate}</p>
            <p className="mt-3 text-sm">Paid: <strong>UGX {UGX.format(item.paid)}</strong></p>
            <p className="text-sm">Balance: <strong className="text-red-600 dark:text-red-400">UGX {UGX.format(item.balance)}</strong></p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  if (!profile?.organization_id || !item.invoiceId || !item.studentId) return
                  const phone = window.prompt('Parent phone in format +2567XXXXXXXX')
                  if (!phone) return
                  try {
                    const result = await initiateMobileMoneyPayment({
                      organizationId: profile.organization_id,
                      invoiceId: item.invoiceId,
                      studentId: item.studentId,
                      phoneNumber: phone,
                      amount: item.balance,
                      provider: 'mtn_momo',
                    })
                    setMessage((result as { message?: string })?.message ?? 'MTN payment request sent')
                  } catch (e) {
                    setError((e as Error).message)
                  }
                }}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                Request MTN MoMo
              </button>
              <button
                onClick={async () => {
                  if (!profile?.organization_id || !item.invoiceId || !item.studentId) return
                  const phone = window.prompt('Parent phone in format +2567XXXXXXXX')
                  if (!phone) return
                  try {
                    const result = await initiateMobileMoneyPayment({
                      organizationId: profile.organization_id,
                      invoiceId: item.invoiceId,
                      studentId: item.studentId,
                      phoneNumber: phone,
                      amount: item.balance,
                      provider: 'airtel_money',
                    })
                    setMessage((result as { message?: string })?.message ?? 'Airtel payment request sent')
                  } catch (e) {
                    setError((e as Error).message)
                  }
                }}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                Request Airtel Money
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

