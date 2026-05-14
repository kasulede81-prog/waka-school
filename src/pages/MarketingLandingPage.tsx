import { useEffect } from 'react'
import { BrandLogoLockup } from '../components/BrandLogo'
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
        <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <BrandLogoLockup tone="dark" layout="stack" className="max-w-md" />
            <div className="mt-3 flex items-center gap-2">
              <span className="h-px w-6 shrink-0 rounded bg-orange-500 opacity-70" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Smarter Schools, Brighter Futures
              </p>
              <span className="h-px w-6 shrink-0 rounded bg-orange-500 opacity-70" />
            </div>
            <p className="mt-1 text-xs text-slate-500">One Platform. Every School. Endless Possibilities.</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm lg:pt-1">
            <a
              href={appLoginUrl()}
              className="rounded-md border border-slate-600 px-3 py-2 text-slate-200 hover:bg-slate-800"
            >
              Staff login
            </a>
            <a
              href={portalLoginUrl()}
              className="rounded-md border border-orange-600/50 bg-orange-950/40 px-3 py-2 text-orange-100 hover:bg-orange-950/70"
            >
              Parent portal
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 md:py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-orange-400/90">Uganda-ready school software</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">Run your school like an institution.</h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">{DESCRIPTION}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href={appSignupUrl()}
            className="rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 hover:bg-orange-400"
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
        <a href={appLoginUrl()} className="text-orange-400 hover:underline">
          app
        </a>
        {' · '}
        <a href={portalLoginUrl()} className="text-orange-400 hover:underline">
          portal
        </a>
      </footer>
    </div>
  )
}
