import { Link, Outlet } from 'react-router-dom'
import { BrandLogoHero, BrandLogoLockup } from '../../components/BrandLogo'

export function AuthLayout({ variant = 'erp' }: { variant?: 'erp' | 'portal' }) {
  const title = variant === 'portal' ? 'Waka Parent Portal' : 'Waka School ERP'
  const blurb =
    variant === 'portal'
      ? 'Parents and guardians: sign in to view fees, attendance, and school updates. Staff should use the main school app.'
      : 'Institutional school administration software for Ugandan schools. Secure multi-tenant onboarding, finance integrity, and role-based access.'

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-100 lg:grid-cols-[420px_1fr] dark:bg-slate-950">
      <aside className="hidden border-r border-slate-200 bg-white p-8 lg:block dark:border-slate-800 dark:bg-slate-900">
        <h1 className="sr-only">{title}</h1>
        <BrandLogoHero tone="light" />
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">{blurb}</p>
      </aside>
      <main className="flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 lg:hidden">
            <BrandLogoLockup layout="inline" sublabel={variant === 'portal' ? 'Parent Portal' : undefined} />
          </div>
          <div className="mb-5 flex items-center justify-between text-xs text-slate-500">
            <span>Authentication</span>
            <Link to="/auth/login" className="text-orange-600 hover:underline dark:text-orange-400">
              Back to login
            </Link>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

