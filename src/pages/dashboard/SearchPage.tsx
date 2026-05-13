import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { erpGlobalSearch, type ErpSearchHit } from '../../lib/data-service'
import { useAuth } from '../../lib/auth'

export function SearchPage() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const urlQ = params.get('q') ?? ''
  const [input, setInput] = useState(urlQ)
  const [activeQ, setActiveQ] = useState(urlQ.trim())
  const [hits, setHits] = useState<ErpSearchHit[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setInput(urlQ)
    setActiveQ(urlQ.trim())
  }, [urlQ])

  useEffect(() => {
    const term = activeQ
    if (term.length < 2 || !profile?.organization_id) {
      setHits([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    erpGlobalSearch(term, 40)
      .then((rows) => {
        if (!cancelled) setHits(rows)
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeQ, profile?.organization_id])

  function runSearch(e: FormEvent) {
    e.preventDefault()
    const term = input.trim()
    setParams(term ? { q: term } : {})
    setActiveQ(term)
  }

  if (!profile?.organization_id) {
    return (
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">ERP search</h2>
        <p className="text-sm text-slate-500">Select an organization context to use universal search.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">ERP search</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Students, staff, invoices, and payments — scoped to your school.
        </p>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={runSearch}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type at least 2 characters…"
          className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {loading ? <p className="text-xs text-slate-500">Searching…</p> : null}
      {!loading && hits.length === 0 && activeQ.length >= 2 ? <p className="text-sm text-slate-500">No matches.</p> : null}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {hits.map((h) => (
          <li key={`${h.result_type}-${h.result_id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <div>
              <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {h.result_type}
              </span>
              <span className="font-medium">{h.label}</span>
              {h.subtitle ? <span className="block text-xs text-slate-500">{h.subtitle}</span> : null}
            </div>
            <Link to={h.route_hint} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
              Open
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
