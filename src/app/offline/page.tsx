/**
 * CODE INSIGHT
 * This code's use case is the offline fallback page, presented when the app cannot load a route due to lost connectivity.
 * This code's full epic context is the PWA shell that precaches navigations and shows an accessible offline page with a retry and navigation back to Home.
 * This code's ui feel is calm, minimal, and mobile-first with clear actions, using Tailwind and theme tokens for a trustworthy experience.
 */

import Link from 'next/link'
import OfflineClient from './client'

export default function OfflinePage() {
  return (
    <main className="w-full">
      <section className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex size-3 rounded-full bg-destructive animate-pulse"
                aria-hidden
              />
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">You’re offline</h1>
            </div>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              We couldn’t reach the network. You can keep browsing cached screens. When you’re back online, try again to continue.
            </p>

            <div className="mt-6">
              <OfflineClient />
            </div>
          </div>

          <div className="bg-muted/40 px-6 sm:px-8 py-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Tip: Some data may be available offline. Recent transactions and pages can still load from cache.
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
