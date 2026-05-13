interface Props {
  title: string
  subtitle?: string
  search: string
  onSearchChange: (value: string) => void
  onCsv: () => void
  onXlsx: () => void
  onPrint: () => void
}

export function ErpToolbar({ title, subtitle, search, onSearchChange, onCsv, onXlsx, onPrint }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search records..."
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button onClick={onCsv} className="rounded-md border border-slate-300 px-3 py-2 text-xs dark:border-slate-700">
          CSV
        </button>
        <button onClick={onXlsx} className="rounded-md border border-slate-300 px-3 py-2 text-xs dark:border-slate-700">
          Excel
        </button>
        <button onClick={onPrint} className="rounded-md border border-slate-300 px-3 py-2 text-xs dark:border-slate-700">
          Print
        </button>
      </div>
    </div>
  )
}

