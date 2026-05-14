import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { BrandLogoLockup } from './BrandLogo'
import { useAuth } from '../lib/auth'
import { appLoginUrl, getMarketingOrigin } from '../lib/site'

export function ParentShell() {
  const { profile, signOut } = useAuth()

  useEffect(() => {
    document.title = 'Waka Parent Portal'
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
          <Link to="/portal" className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 rounded-md">
            <BrandLogoLockup layout="inline" sublabel="Parent Portal" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">{profile?.full_name}</span>
            <button onClick={signOut} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl p-4">
        <nav className="mb-4 flex gap-2 text-sm">
          <NavLink
            to="/portal"
            end
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 ${isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'text-slate-600 hover:underline dark:text-slate-400'}`
            }
          >
            Home
          </NavLink>
        </nav>
        <main className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 dark:border-slate-800 dark:bg-slate-900">
          <Outlet />
        </main>
      </div>
      <p className="mt-6 text-center text-[10px] text-slate-400">
        Staff?{' '}
        <a href={appLoginUrl()} className="text-emerald-700 hover:underline dark:text-emerald-400">
          Open the school app
        </a>
        {' · '}
        <a href={getMarketingOrigin()} className="hover:underline" rel="noreferrer">
          wakaschool.org
        </a>
      </p>
    </div>
  )
}
