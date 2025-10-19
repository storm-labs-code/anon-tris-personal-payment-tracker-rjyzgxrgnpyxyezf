/**
 * CODE INSIGHT
 * This code's use case is to provide a month-scoped sub-layout for the Budgets section, offering a sticky month switcher with previous/next controls,
 * an accessible month picker, and a concise action area with an “Edit budgets” link. It wraps all month-specific budget pages consistently.
 * This code's full epic context is the Budgets Overview and Editor flows, where navigation between months is URL-driven and editing occurs under /budgets/[month]/edit.
 * This code's ui feel is calm, minimal, and mobile-first with a subtle sticky header, clear navigation affordances, and space for inline alerts below the header.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

function safeParseMonth(param: string): Date {
  // Expecting YYYY-MM; fallback to current month if invalid
  const m = /^\d{4}-(0[1-9]|1[0-2])$/.exec(param)?.[0]
  if (!m) {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  }
  const [y, mo] = m.split('-').map(Number)
  return new Date(Date.UTC(y, (mo as number) - 1, 1))
}

function addMonthsUTC(dateUTC: Date, delta: number): Date {
  const y = dateUTC.getUTCFullYear()
  const m = dateUTC.getUTCMonth()
  return new Date(Date.UTC(y, m + delta, 1))
}

function monthKeyUTC(dateUTC: Date): string {
  const y = dateUTC.getUTCFullYear()
  const m = String(dateUTC.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthLabel(dateUTC: Date, locale: string = 'ko-KR'): string {
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(dateUTC)
  } catch {
    return `${dateUTC.getUTCFullYear()}-${String(dateUTC.getUTCMonth() + 1).padStart(2, '0')}`
  }
}

function buildPickerRange(center: Date, before = 6, after = 6) {
  const items: { key: string; date: Date; label: string }[] = []
  for (let i = -before; i <= after; i++) {
    const d = addMonthsUTC(center, i)
    items.push({ key: monthKeyUTC(d), date: d, label: formatMonthLabel(d) })
  }
  return items
}

export default function BudgetsMonthLayout({ children, params }: { children: ReactNode; params: { month: string } }) {
  const current = safeParseMonth(params.month)
  const prev = addMonthsUTC(current, -1)
  const next = addMonthsUTC(current, 1)

  const currentKey = monthKeyUTC(current)
  const prevKey = monthKeyUTC(prev)
  const nextKey = monthKeyUTC(next)

  const monthLabel = formatMonthLabel(current)
  const pickerItems = buildPickerRange(current)

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Sticky month switcher */}
      <header className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-screen-md items-center justify-between gap-2 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <Link
              href={`/budgets/${prevKey}`}
              aria-label="Previous month"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M15.78 19.28a.75.75 0 0 1-1.06 0l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 1 1 1.06 1.06L10.06 12l5.72 5.72a.75.75 0 0 1 0 1.06z" clipRule="evenodd" />
              </svg>
            </Link>

            <div className="relative">
              <details className="group relative">
                <summary className="list-none cursor-pointer select-none rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                  <span className="align-middle">{monthLabel}</span>
                  <span aria-hidden className="ml-1 align-middle text-muted-foreground">▾</span>
                </summary>
                <div className="absolute left-0 mt-2 w-56 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
                  <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Select month</div>
                  <ul className="max-h-60 overflow-auto">
                    {pickerItems.map((it) => (
                      <li key={it.key}>
                        <Link
                          href={`/budgets/${it.key}`}
                          className={`block rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                            it.key === currentKey ? 'bg-primary/10 text-primary' : ''
                          }`}
                        >
                          {it.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </div>

            <Link
              href={`/budgets/${nextKey}`}
              aria-label="Next month"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M8.22 4.72a.75.75 0 0 1 1.06 0l6 6a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 1 1-1.06-1.06L13.94 12 8.22 6.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/budgets/${currentKey}/edit`}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M5 20h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2zm14.71-14.29-1.42-1.42a1 1 0 0 0-1.41 0L9 12.17V15h2.83l7.88-7.88a1 1 0 0 0 0-1.41z" />
              </svg>
              <span>Edit budgets</span>
            </Link>
          </div>
        </div>
        {/* Alerts mount area (filled by children pages) */}
        <div className="mx-auto w-full max-w-screen-md px-4 pb-2 md:px-6" id="budget-alerts" />
      </header>

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 pb-16 pt-4 md:px-6">
        {children}
      </main>
    </div>
  )
}
