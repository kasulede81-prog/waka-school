/**
 * Waka School brand mark + wordmark (SVG approximates supplied logo: book, check, cap; orange + slate).
 */

const ORANGE = '#ea580c'
const ORANGE_DEEP = '#c2410c'
const PAGE = '#fff7ed'

type Tone = 'light' | 'dark'

export function BrandLogoMark({ className = 'h-10 w-10 shrink-0' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Waka School"
      role="img"
    >
      <path d="M10 52 L36 46 L36 58 L10 54 Z" fill={ORANGE_DEEP} />
      <path d="M36 46 L62 52 L62 54 L36 58 Z" fill={ORANGE} />
      <path d="M8 52 L36 44 L64 52 L64 56 L36 48 L8 56 Z" fill={PAGE} stroke={ORANGE} strokeWidth="1.2" />
      <path
        d="M20 48 L32 58 L52 30"
        stroke={ORANGE}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M24 28 L48 28 L50 36 L22 36 Z" fill={ORANGE} />
      <path d="M22 36 L50 36 L52 40 L20 40 Z" fill={ORANGE_DEEP} />
      <path d="M34 40 L38 40 L38 52 L34 52 Z" fill={ORANGE_DEEP} />
      <circle cx="20" cy="42" r="2" fill={ORANGE_DEEP} />
    </svg>
  )
}

function schoolTextClass(tone: Tone) {
  return tone === 'dark' ? 'text-slate-100' : 'text-slate-900 dark:text-slate-100'
}

export function BrandLogoLockup({
  tone = 'light',
  layout = 'inline',
  className = '',
  sublabel,
}: {
  tone?: Tone
  layout?: 'inline' | 'stack'
  className?: string
  /** e.g. "Parent Portal" under the wordmark */
  sublabel?: string
}) {
  const waka = <span className="font-bold tracking-tight text-orange-500">Waka</span>
  const school = <span className={`font-bold tracking-tight ${schoolTextClass(tone)}`}>School</span>

  if (layout === 'stack') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-3">
          <BrandLogoMark className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
          <div className="leading-tight">
            {waka}
            <br />
            {school}
          </div>
        </div>
        {sublabel ? (
          <p
            className={`text-sm font-medium ${tone === 'dark' ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {sublabel}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <BrandLogoMark className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
      <div className="leading-tight">
        <span className="block text-base font-bold tracking-tight sm:text-lg">{waka}</span>
        <span className={`block text-base font-bold tracking-tight sm:text-lg ${schoolTextClass(tone)}`}>{school}</span>
        {sublabel ? (
          <p className={`text-[11px] font-medium ${tone === 'dark' ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>{sublabel}</p>
        ) : null}
      </div>
    </div>
  )
}

export function BrandLogoHero({ tone = 'light', className = '' }: { tone?: Tone; className?: string }) {
  const line = tone === 'dark' ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'
  const sub = tone === 'dark' ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400'

  return (
    <div className={`space-y-4 ${className}`}>
      <BrandLogoLockup tone={tone} layout="stack" />
      <div className="flex items-center gap-2 pt-1">
        <span className="h-px flex-1 rounded bg-orange-500 opacity-60" />
        <p className={`text-center text-[10px] font-semibold uppercase tracking-widest ${line}`}>Smarter Schools, Brighter Futures</p>
        <span className="h-px flex-1 rounded bg-orange-500 opacity-60" />
      </div>
      <p className={`text-center text-xs sm:text-sm ${sub}`}>One Platform. Every School. Endless Possibilities.</p>
    </div>
  )
}
