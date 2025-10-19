/**
 * CODE INSIGHT
 * This code's use case is to provide a clean, mobile-first sub-layout for the Tags management area.
 * This code's full epic context is the Manage section where users organize tags, with a header that includes a search form
 * that forwards the `search` query to child pages, and quick navigation to sibling manage areas (Categories, Presets) and to New Transaction.
 * This code's UI feel is calm, modern, and focused, with a sticky header, accessible search, and minimal navigation tabs.
 */

import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/utils/utils'

export default function TagsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Tags</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Organize tag names for faster entry and better reports.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/transactions/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="inline-block">New Transaction</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 pb-3">
            <nav className="w-full">
              <ul className="inline-flex items-center gap-1 rounded-xl bg-muted/40 p-1">
                <li>
                  <Link
                    href="/categories"
                    className={cn(
                      'px-3.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors'
                    )}
                  >
                    Categories
                  </Link>
                </li>
                <li>
                  <Link
                    href="/tags"
                    aria-current="page"
                    className={cn(
                      'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                      'bg-background text-foreground shadow-sm'
                    )}
                  >
                    Tags
                  </Link>
                </li>
                <li>
                  <Link
                    href="/presets"
                    className={cn(
                      'px-3.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors'
                    )}
                  >
                    Presets
                  </Link>
                </li>
              </ul>
            </nav>

            <form action="/tags" method="GET" className="flex items-center gap-2">
              <label htmlFor="tag-search" className="sr-only">Search tags</label>
              <input
                id="tag-search"
                name="search"
                type="search"
                inputMode="search"
                placeholder="Search tags"
                className="flex-1 rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                autoComplete="off"
              />
              <button
                type="submit"
                className="inline-flex items-center rounded-xl border border-input bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Search
              </button>
            </form>
          </div>
        </div>
        <Separator />
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-4 sm:py-6">
        {children}
      </main>

      <div className="sm:hidden fixed bottom-4 right-4 z-40">
        <Link
          href="/transactions/new"
          className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg h-12 w-12 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Add new transaction"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </Link>
      </div>
    </div>
  )
}
