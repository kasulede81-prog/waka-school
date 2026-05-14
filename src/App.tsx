import { Suspense } from 'react'
import { getSiteKind } from './lib/site'
import { ErpSiteRoutes } from './routes/ErpSiteRoutes'
import { MarketingRoutes } from './routes/MarketingRoutes'
import { PortalSiteRoutes } from './routes/PortalSiteRoutes'

export default function App() {
  const kind = getSiteKind()

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading module…</div>}>
      {kind === 'marketing' ? <MarketingRoutes /> : kind === 'portal' ? <PortalSiteRoutes /> : <ErpSiteRoutes />}
    </Suspense>
  )
}
