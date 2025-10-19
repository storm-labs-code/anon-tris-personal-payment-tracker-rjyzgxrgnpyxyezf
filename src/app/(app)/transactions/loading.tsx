/**
 * CODE INSIGHT
 * This code's use case is to render the transactions list loading skeletons, providing immediate visual feedback while data for the transactions index page is fetched.
 * This code's full epic context is the demo Transactions list under the (app) group using SWR, where loading.tsx shows shimmers for headers, filters, summary cards, and list rows, matching the mobile-first PWA experience.
 * This code's ui feel is clean, calm, and modern with subtle shimmers, comfortable spacing, and token-based theming for seamless dark/light modes.
 */

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  const rows = Array.from({ length: 8 })

  return (
    <main className="relative flex flex-col gap-4 p-4 md:p-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading transactions…</span>

      {/* Header: title + quick actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-8 w-40 rounded-md" />
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>

      {/* Filters / Chips (mobile visible) */}
      <div className="flex gap-2 sm:hidden">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-16 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl hidden sm:block" />
        <Skeleton className="h-20 rounded-xl hidden sm:block" />
      </div>

      {/* Transactions list */}
      <div className="rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((_, i) => (
            <li key={i} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-28 rounded" />
                </div>
              </div>
              <div className="ml-4 flex min-w-[88px] flex-col items-end">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="mt-2 h-3 w-12 rounded" />
              </div>
            </li>
          ))}
        </ul>

        {/* List footer loader */}
        <div className="flex items-center justify-center p-4">
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>

      {/* Floating Action Button placeholder (non-interactive) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-10 flex justify-center md:bottom-6">
        <Skeleton className="h-14 w-14 rounded-full shadow-lg shadow-black/10" />
      </div>
    </main>
  )
}
