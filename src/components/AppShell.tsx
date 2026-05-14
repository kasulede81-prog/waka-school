import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { filterNavSections } from '../config/navigation'
import { getMarketingOrigin } from '../lib/site'

export function AppShell() {
  const { profile, signOut, permissions } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const navSections = useMemo(() => filterNavSections(profile, permissions), [profile, permissions])

  useEffect(() => {
    document.title = 'Waka School ERP'
  }, [])

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    navigate(`/dashboard/search?q=${encodeURIComponent(term)}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link to="/dashboard" className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
            Waka School
          </Link>
          <form onSubmit={submitSearch} className="flex max-w-md flex-1 items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ERP…"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button type="submit" className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-white dark:bg-slate-200 dark:text-slate-900">
              Search
            </button>
          </form>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">{profile?.full_name ?? 'User'}</span>
            <button type="button" onClick={signOut} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1400px] gap-4 p-4">
        <aside className="hidden w-72 rounded-xl border border-slate-200 bg-white p-3 md:block dark:border-slate-800 dark:bg-slate-900">
          <nav className="space-y-4">
            {navSections.map((module) => (
              <div key={module.section}>
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{module.section}</p>
                {module.links.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                        isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <main className="min-h-[80vh] flex-1 rounded-xl border border-slate-200 bg-white p-4 md:p-6 dark:border-slate-800 dark:bg-slate-900">
          <Outlet />
        </main>
      </div>
      <footer className="mx-auto mt-4 hidden max-w-[1400px] px-4 text-center text-[10px] text-slate-400 md:block">
        <a href={getMarketingOrigin()} className="hover:underline" rel="noreferrer">
          wakaschool.org
        </a>
      </footer>
    </div>
  )
}
