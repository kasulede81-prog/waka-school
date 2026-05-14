import { Navigate, Route, Routes } from 'react-router-dom'
import { RedirectToAppOrigin } from '../components/CrossDomainRedirects'
import { MarketingLandingPage } from '../pages/MarketingLandingPage'

export function MarketingRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MarketingLandingPage />} />
      <Route path="/auth/*" element={<RedirectToAppOrigin />} />
      <Route path="/kiosk/*" element={<RedirectToAppOrigin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
