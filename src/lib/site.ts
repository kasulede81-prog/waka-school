/**
 * Production multi-domain layout:
 * - Marketing: VITE_MARKETING_URL (wakaschool.org / www)
 * - ERP app:   VITE_APP_URL (app.wakaschool.org)
 * - Parent:    VITE_PORTAL_URL (portal.wakaschool.org)
 * - Dev:       localhost / 127.0.0.1 → permissive single-origin (all routes)
 */

export type SiteKind = 'marketing' | 'app' | 'portal' | 'dev'

function trimSlash(s: string) {
  return s.replace(/\/+$/, '')
}

function originFromEnv(value: string | undefined, fallback: string): string {
  const raw = value?.trim()
  if (!raw) return trimSlash(fallback)
  try {
    return trimSlash(new URL(raw).origin)
  } catch {
    return trimSlash(fallback)
  }
}

export function getMarketingOrigin(): string {
  const fromEnv = originFromEnv(import.meta.env.VITE_MARKETING_URL as string | undefined, '')
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase()
    if (marketingHostnames().has(h)) return window.location.origin
    return 'https://wakaschool.org'
  }
  return 'https://wakaschool.org'
}

function browserAppOriginFallback(): string {
  if (typeof window === 'undefined') return 'https://app.wakaschool.org'
  const h = window.location.hostname.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1') return window.location.origin
  return 'https://app.wakaschool.org'
}

function browserPortalOriginFallback(): string {
  if (typeof window === 'undefined') return 'https://portal.wakaschool.org'
  const h = window.location.hostname.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1') return window.location.origin
  return 'https://portal.wakaschool.org'
}

export function getAppOrigin(): string {
  if (typeof window !== 'undefined') {
    return originFromEnv(import.meta.env.VITE_APP_URL as string | undefined, browserAppOriginFallback())
  }
  return originFromEnv(import.meta.env.VITE_APP_URL as string | undefined, 'http://localhost:5173')
}

export function getPortalOrigin(): string {
  if (typeof window !== 'undefined') {
    return originFromEnv(import.meta.env.VITE_PORTAL_URL as string | undefined, browserPortalOriginFallback())
  }
  return originFromEnv(import.meta.env.VITE_PORTAL_URL as string | undefined, 'http://localhost:5173')
}

function marketingHostnames(): Set<string> {
  const hosts = new Set(['wakaschool.org', 'www.wakaschool.org'])
  const raw = import.meta.env.VITE_MARKETING_URL as string | undefined
  if (raw?.trim()) {
    try {
      const apex = new URL(raw.trim()).hostname.toLowerCase()
      hosts.add(apex)
      hosts.add(`www.${apex}`)
    } catch {
      /* ignore */
    }
  }
  return hosts
}

function appHostname(): string {
  try {
    return new URL(getAppOrigin()).hostname.toLowerCase()
  } catch {
    return 'app.wakaschool.org'
  }
}

function portalHostname(): string {
  try {
    return new URL(getPortalOrigin()).hostname.toLowerCase()
  } catch {
    return 'portal.wakaschool.org'
  }
}

export function getSiteKind(): SiteKind {
  if (typeof window === 'undefined') return 'dev'
  const h = window.location.hostname.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1') return 'dev'
  if (marketingHostnames().has(h)) return 'marketing'
  if (h === appHostname()) return 'app'
  if (h === portalHostname()) return 'portal'
  // Preview / staging hosts: behave like ERP app
  return 'app'
}

export function appLoginUrl() {
  return `${getAppOrigin()}/auth/login`
}

export function portalLoginUrl() {
  return `${getPortalOrigin()}/auth/login`
}

export function appSignupUrl() {
  return `${getAppOrigin()}/auth/signup`
}

export function passwordResetRedirectUrl(): string {
  if (typeof window === 'undefined') return `${getAppOrigin()}/auth/reset-password`
  return `${window.location.origin}/auth/reset-password`
}

export function emailConfirmationRedirectUrl(): string {
  return `${getAppOrigin()}/auth/login`
}

export function redirectToParentHome() {
  if (typeof window === 'undefined') return
  window.location.replace(`${getPortalOrigin()}/portal`)
}

export function redirectToStaffApp(path = '/dashboard') {
  if (typeof window === 'undefined') return
  const p = path.startsWith('/') ? path : `/${path}`
  window.location.replace(`${getAppOrigin()}${p}`)
}

export function postLoginPath(role: string | undefined): '/portal' | '/dashboard' {
  return role === 'parent' ? '/portal' : '/dashboard'
}
