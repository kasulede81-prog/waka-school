import { useEffect } from 'react'
import { appLoginUrl, appSignupUrl, getMarketingOrigin, portalLoginUrl } from '../lib/site'

const DESCRIPTION =
  'Waka School is institutional ERP and parent engagement software for Ugandan schools — finance, attendance, mobile money, and multi-tenant operations.'

export function MarketingLandingPage() {
  useEffect(() => {
    document.title = 'Waka School — School operations & parent portal'
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = DESCRIPTION

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = `${getMarketingOrigin()}/`
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/70 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <span className="text-lg font-bold tracking-tight text-emerald-400">Waka School</span>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <a
              href={appLoginUrl()}
              className="rounded-md border border-slate-600 px-3 py-2 text-slate-200 hover:bg-slate-800"
            >
              Staff login
            </a>
            <a
              href={portalLoginUrl()}
              className="rounded-md border border-emerald-700/60 bg-emerald-900/30 px-3 py-2 text-emerald-100 hover:bg-emerald-900/50"
            >
              Parent portal
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 md:py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400/90">Uganda-ready school software</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">Run your school like an institution.</h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">{DESCRIPTION}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href={appSignupUrl()}
            className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-900/40 hover:bg-emerald-400"
          >
            Start with the ERP
          </a>
          <a href={portalLoginUrl()} className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-slate-800">
            Parents sign in
          </a>
        </div>
        <ul className="mt-16 grid gap-4 text-sm text-slate-300 md:grid-cols-3">
          <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">Multi-tenant finance, fees, and mobile money reconciliation</li>
          <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">Attendance, QR staff check-in, and academic records</li>
          <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">Dedicated parent portal — separate from staff systems</li>
        </ul>
      </main>

      <footer className="border-t border-slate-800 px-4 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Waka School ·{' '}
        <a href={appLoginUrl()} className="text-emerald-600 hover:underline">
          app
        </a>
        {' · '}
        <a href={portalLoginUrl()} className="text-emerald-600 hover:underline">
          portal
        </a>
      </footer>
    </div>
  )
}
