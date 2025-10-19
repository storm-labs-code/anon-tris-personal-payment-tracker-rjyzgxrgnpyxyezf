/**
 * CODE INSIGHT
 * This code's use case is to provide a consistent sub-layout for all Transaction-related pages
 * (new, detail, edit) with a compact header, persistent bottom navigation, and a floating action
 * button for quick entry. It ensures mobile-first ergonomics with safe-area padding and full-height
 * forms, while keeping navigation simple and calming.
 * This code's full epic context is the Tris PWA offline-first personal payment tracker, where
 * transactions are frequently added/edited offline and synced later. The layout offers quick access
 * to Home, Queue, and Conflicts, without overwhelming the user.
 * This code's UI feel is clean, modern, and minimal with subtle affordances, clear labeling, and
 * accessible contrast, following a primary blue theme and neutral surfaces.
 */

import Link from 'next/link'

export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <Link
              href="/"
              aria-label="Back to Home"
              className="inline-flex items-center gap-2 rounded-full p-2 text-foreground/80 hover:text-foreground hover:bg-accent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="sr-only">Back</span>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-base font-semibold tracking-tight">Transactions</h1>
            <div className="flex items-center gap-1">
              <Link
                href="/queue"
                className="inline-flex items-center gap-2 rounded-full p-2 text-foreground/80 hover:text-foreground hover:bg-accent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open Sync Queue"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M3 12h12M3 18h6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 pb-32 pt-4 sm:pt-6">
        {children}
      </main>

      {/* Floating Action Button - Add Transaction */}
      <Link
        href="/transactions/new"
        aria-label="Add transaction"
        className="fixed right-5 sm:right-8 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition focus:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>

      {/* Bottom Navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/70"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="mx-auto w-full max-w-5xl">
          <ul className="grid grid-cols-3 items-stretch text-xs font-medium">
            <li>
              <Link
                href="/"
                className="group flex h-14 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Home"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 11l9-7 9 7" />
                  <path d="M9 22V12h6v10" />
                </svg>
                <span>Home</span>
              </Link>
            </li>
            <li>
              <Link
                href="/queue"
                className="group flex h-14 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Queue"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 6h16" />
                  <path d="M4 12h10" />
                  <path d="M4 18h6" />
                </svg>
                <span>Queue</span>
              </Link>
            </li>
            <li>
              <Link
                href="/conflicts"
                className="group flex h-14 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Conflicts"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
                <span>Conflicts</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </section>
  )
}
