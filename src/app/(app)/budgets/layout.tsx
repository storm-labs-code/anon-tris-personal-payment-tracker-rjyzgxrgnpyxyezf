/**
 * CODE INSIGHT
 * This code's use case is to provide a lightweight, consistent sub-layout for all Budgets pages.
 * This code's full epic context is the Budgets module shell, ensuring a sticky section header, clean spacing, and scrollable content that wraps Overview and Editor pages without duplicating global app chrome.
 * This code's ui feel is calm, modern, and mobile-first with a sticky translucent header, subtle borders, and comfortable padding that adapts across breakpoints.
 */

import Link from 'next/link'
import { Separator } from '@/components/ui/separator'

export default function BudgetsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <header
        className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border"
        aria-label="Budgets section header"
      >
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight">Budgets</h1>
              <p className="hidden sm:block text-sm text-muted-foreground">Track monthly limits and spending in KRW</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Link
                href="/budgets"
                aria-label="Jump to current month overview"
                className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                This month
              </Link>
            </div>
          </div>
        </div>
      </header>

      <Separator className="sr-only" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {children}
        </div>
      </main>

      <footer className="mt-auto border-t border-border bg-background/60">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>Budgets</span>
          <Link
            href="/budgets"
            className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
          >
            Overview
          </Link>
        </div>
      </footer>
    </div>
  )
}
