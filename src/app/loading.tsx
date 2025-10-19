/**
 * CODE INSIGHT
 * This code's use case is to render a global, fast-loading skeleton UI while the app's initial content is fetched and hydrated.
 * This code's full epic context is the PWA shell for Tris, showing a calm, modern shimmer that suggests dashboard summaries and a transaction list without duplicating header/footer/sidebar provided by layout.
 * This code's ui feel is clean, minimal, mobile-first, with subtle motion and accessible semantics to reassure users during cold start.
 */

import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/utils'

export default function Loading() {
  return (
    <main
      aria-busy="true"
      role="status"
      aria-live="polite"
      className={cn(
        'w-full',
        'min-h-[100dvh]',
        'bg-background',
        'px-4 sm:px-6 md:px-8 py-6',
        'animate-[fadeIn_200ms_ease-out]'
      )}
    >
      {/* Top greeting/title skeleton */}
      <div className="max-w-6xl mx-auto">
        <div className="space-y-3 mb-5">
          <Skeleton className="h-5 w-24 sm:w-28 bg-muted" />
          <div className="flex items-end gap-3">
            <Skeleton className="h-8 w-40 sm:w-56 bg-muted" />
            <Skeleton className="h-6 w-16 bg-muted hidden sm:block" />
          </div>
        </div>

        {/* Summary cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              aria-hidden
            >
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-4 w-24 bg-muted" />
                <Skeleton className="h-8 w-8 rounded-xl bg-muted" />
              </div>
              <Skeleton className="h-7 w-28 sm:w-32 bg-muted mb-2" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-16 bg-muted" />
                <Skeleton className="h-3 w-10 bg-muted" />
              </div>
            </div>
          ))}
        </div>

        {/* Chart preview skeleton */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm mb-6" aria-hidden>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-24 bg-muted" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-16 rounded-lg bg-muted" />
              <Skeleton className="h-8 w-16 rounded-lg bg-muted" />
              <Skeleton className="h-8 w-16 rounded-lg bg-muted" />
            </div>
          </div>
          <Skeleton className="h-40 w-full bg-muted rounded-xl" />
        </div>

        {/* Transactions list skeleton */}
        <div className="space-y-3">
          {[...Array(6)].map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
              aria-hidden
            >
              <div className="flex items-center">
                <Skeleton className="h-10 w-10 rounded-xl bg-muted shrink-0" />
                <div className="ml-4 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-32 sm:w-48 bg-muted" />
                    <Skeleton className="h-5 w-16 sm:w-20 bg-muted" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Skeleton className="h-3 w-20 bg-muted" />
                    <Skeleton className="h-3 w-10 bg-muted hidden sm:block" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Button placeholder (visual hint, non-interactive) */}
      <div className="pointer-events-none fixed right-5 bottom-24 sm:bottom-10">
        <div className="relative">
          <Skeleton className="h-14 w-14 rounded-full bg-primary/20" />
          <span className="sr-only">Loading actions</span>
        </div>
      </div>
    </main>
  )
}
