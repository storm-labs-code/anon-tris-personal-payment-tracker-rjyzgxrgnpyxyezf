/**
 * CODE INSIGHT
 * This code's use case is to render an elegant, responsive skeleton UI for the Home dashboard while data loads.
 * This code's full epic context is the app shell’s segment-level loading for the (app) group, matching the
 * dashboard structure: summary cards, a chart area, and a recent transactions list with mobile-first polish.
 * This code's ui feel is calm, minimal, and confident—using subtle skeletons, soft cards, and clear spacing
 * that align with Tris’s KRW-focused, mobile-first design and theming.
 */

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <section aria-busy className="w-full">
      <div className="sr-only" role="status" aria-live="polite">
        Loading dashboard…
      </div>

      <div className="space-y-6 p-4 sm:p-6 md:p-8">
        {/* Page heading skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Chart section */}
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent transactions list */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between p-4 sm:p-5">
            <Skeleton className="h-6 w-36" />
            <div className="hidden sm:flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 sm:p-5">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Skeleton className="h-11 w-11 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40 sm:w-56" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="ml-4 h-5 w-16 sm:w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom space to avoid overlap with persistent bottom nav */}
        <div className="h-16" aria-hidden />
      </div>
    </section>
  )
}
