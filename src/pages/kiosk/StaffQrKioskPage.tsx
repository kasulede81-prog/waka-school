import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { getStaffQrKioskContext, recordStaffQrCheckIn } from '../../lib/data-service'

type CampusOpt = { id: string; name: string; code: string | null }

const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

function extractToken(text: string): string | null {
  const m = text.match(uuidRe)
  return m ? m[0] : null
}

export function StaffQrKioskPage() {
  const [params] = useSearchParams()
  const initial = params.get('t') ?? ''
  const [token, setToken] = useState(initial)
  const [campuses, setCampuses] = useState<CampusOpt[]>([])
  const [campusId, setCampusId] = useState<string>('')
  const [teacherName, setTeacherName] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const readerId = 'staff-qr-reader'

  const loadContext = useCallback(async (secret: string) => {
    setError('')
    setStatus('')
    if (!secret || !uuidRe.test(secret)) {
      setCampuses([])
      setTeacherName('')
      return
    }
    try {
      const ctx = await getStaffQrKioskContext(secret)
      if (ctx && ctx.ok === true) {
        setTeacherName(String(ctx.teacher_name ?? ''))
        const c = (ctx.campuses as CampusOpt[]) ?? []
        setCampuses(c)
        setCampusId((prev) => (prev && c.some((x) => x.id === prev) ? prev : c[0]?.id ?? ''))
      } else {
        setTeacherName('')
        setCampuses([])
        setError(String((ctx as { error?: string })?.error ?? 'Invalid or expired staff QR.'))
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void loadContext(token.trim())
  }, [token, loadContext])

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {
        /* ignore */
      }
      scannerRef.current.clear()
      scannerRef.current = null
    }
    setScanning(false)
  }

  useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [])

  async function startCamera() {
    setError('')
    await stopScanner()
    const html5 = new Html5Qrcode(readerId)
    scannerRef.current = html5
    setScanning(true)
    try {
      await html5.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 260, height: 260 } },
        async (decoded) => {
          const sec = extractToken(decoded)
          if (sec) {
            setToken(sec)
            await stopScanner()
          }
        },
        () => {},
      )
    } catch (e) {
      setScanning(false)
      scannerRef.current = null
      setError((e as Error).message || 'Camera could not start. Use manual token entry.')
    }
  }

  async function submitCheckIn() {
    setError('')
    setStatus('')
    const sec = token.trim()
    if (!uuidRe.test(sec)) {
      setError('Enter a valid staff QR token (UUID).')
      return
    }
    try {
      const res = await recordStaffQrCheckIn({
        secret: sec,
        campusId: campusId || null,
        device: typeof navigator !== 'undefined' ? navigator.userAgent : 'kiosk',
      })
      if (res?.ok === true) {
        setStatus(`Checked in: ${res.teacher_name as string} (${String(res.status)})`)
      } else {
        setError(String(res?.error ?? 'Check-in failed'))
        if (res?.teacher_name) setStatus(String(res.teacher_name))
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white">Staff attendance kiosk</h1>
          <p className="mt-1 text-sm text-slate-400">Scan the code on your ID card. Duplicate scans for the same day are rejected.</p>
        </div>

        <div id={readerId} className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-slate-700 bg-black" />

        <div className="flex flex-wrap justify-center gap-2">
          {!scanning ? (
            <button type="button" onClick={() => void startCamera()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
              Use camera
            </button>
          ) : (
            <button type="button" onClick={() => void stopScanner()} className="rounded-lg border border-slate-600 px-4 py-2 text-sm">
              Stop camera
            </button>
          )}
        </div>

        <label className="block text-xs font-medium text-slate-400">QR secret (UUID)</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Paste token or scan"
          autoComplete="off"
        />

        {teacherName ? <p className="text-center text-sm text-emerald-400">Card matches: {teacherName}</p> : null}

        {campuses.length > 0 ? (
          <div>
            <label className="block text-xs font-medium text-slate-400">Campus</label>
            <select value={campusId} onChange={(e) => setCampusId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
              <option value="">Not specified</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.code ? ` (${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <button type="button" onClick={() => void submitCheckIn()} className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white">
          Record check-in
        </button>

        {status ? <p className="text-center text-sm text-emerald-400">{status}</p> : null}
        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}

        <p className="text-center text-xs text-slate-500">
          <Link to="/auth/login" className="underline">
            Staff login
          </Link>
        </p>
      </div>
    </div>
  )
}
