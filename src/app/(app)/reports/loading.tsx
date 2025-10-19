/**
 * CODE INSIGHT
 * This code's use case is to render the loading skeleton UI for the Reports page while data is being fetched.
 * This code's full epic context is the demo Reports flow using SWR and client-side fetching; this server component provides immediate visual placeholders for charts and legends per the PWA shell strategy.
 * This code's ui feel is clean, calm, and mobile-first with subtle shimmer blocks, card layouts, and accessible status cues matching Tris’s design system.
 */

import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

export default function Loading() {
  const bars = Array.from({ length: 10 })
  const gridLines = Array.from({ length: 5 })
  const legendItems = Array.from({ length: 6 })

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4" aria-busy="true">
      <p className="sr-only">Loading reports…</p>

      {/* Header Controls Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-16 hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
        </div>
      </div>

      {/* Summary Cards Skeleton */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <Skeleton className="h-4 w-20" />
            <div className="mt-3">
              <Skeleton className="h-7 w-24" />
            </div>
            <div className="mt-2">
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart Card Skeleton */}
      <div className="mt-4 rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="relative mt-4 h-[240px] sm:h-[300px] rounded-lg bg-muted/40 overflow-hidden">
          {/* Horizontal grid lines */}
          {gridLines.map((_, i) => (
            <div
              key={i}
              aria-hidden
              className="absolute left-0 right-0 border-t border-dashed border-border/60"
              style={{ top: `${((i + 1) / (gridLines.length + 1)) * 100}%` }}
            />
          ))}
          {/* Bars */}
          <div className="absolute inset-x-3 bottom-3 top-8 flex items-end gap-2">
            {bars.map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-muted/80"
                aria-hidden
                style={{ height: `${28 + ((i * 13) % 55)}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown & Legend Skeleton */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3">
                <Skeleton className="h-4 w-24" />
                <div className="mt-2">
                  <Skeleton className="h-6 w-28" />
                </div>
                <div className="mt-2">
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <Skeleton className="h-5 w-28" />
          <Separator className="my-4" />
          <ul className="space-y-3">
            {legendItems.map((_, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="text-right">
                  <Skeleton className="h-4 w-20" />
                </div>
              </li>
            ))}
          </ul>
          <Separator className="my-4" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}
