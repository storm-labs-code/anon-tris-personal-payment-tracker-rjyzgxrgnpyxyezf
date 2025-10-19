/**
 * CODE INSIGHT
 * This code's use case is to provide a clean, focused sub-layout for all /recurring pages.
 * This code's full epic context is the Recurring Rules flow, giving users a consistent header,
 * quick access to related areas (Upcoming, Calendar, Notifications), and a clear CTA to create new rules.
 * This code's ui feel is calm, modern, and mobile-first with subtle affordances and accessible touch targets.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export default async function RecurringLayout({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Recurring rules</h1>
              <p className="mt-1 text-sm text-muted-foreground">Automate bills and reminders. Create rules once, track them effortlessly.</p>
            </div>
            <div className="shrink-0 pl-3">
              <Link
                href="/recurring/new"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Create a new recurring rule"
              >
                <PlusIcon className="h-4 w-4" />
                <span className="hidden sm:inline">New rule</span>
                <span className="sm:hidden">New</span>
              </Link>
            </div>
          </div>

          <nav className="-mx-1 mb-2 mt-1 flex flex-wrap items-center gap-1.5 sm:mb-3" aria-label="Recurring navigation">
            <Link
              href="/recurring"
              className="inline-flex items-center rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Rules
            </Link>
            <Link
              href="/upcoming"
              className="inline-flex items-center rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Upcoming
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Calendar
            </Link>
            <Link
              href="/notifications"
              className="inline-flex items-center rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Notifications
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
        {children}
      </main>

      <Link
        href="/recurring/new"
        aria-label="Add recurring rule"
        className="fixed bottom-24 right-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-8 md:right-8"
      >
        <PlusIcon className="h-6 w-6" />
        <span className="sr-only">Create new recurring rule</span>
      </Link>
    </section>
  )
}
