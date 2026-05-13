import { Link, Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-100 lg:grid-cols-[420px_1fr] dark:bg-slate-950">
      <aside className="hidden border-r border-slate-200 bg-white p-8 lg:block dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">Waka School ERP</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Institutional school administration software for Ugandan schools. Secure multi-tenant onboarding, finance integrity, and role-based access.
        </p>
      </aside>
      <main className="flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between text-xs text-slate-500">
            <span>Authentication</span>
            <Link to="/auth/login" className="text-emerald-700 dark:text-emerald-400">
              Back to login
            </Link>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

