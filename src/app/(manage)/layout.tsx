/**
 * CODE INSIGHT
 * This code's use case is to provide a shared sub-layout for the Manage section (Categories, Tags, Presets),
 * offering a consistent header with a back button to the root dashboard, a segmented tab navigation, and a clean
 * container for nested pages. It avoids duplicating global headers and keeps the UI calm, mobile-first, and practical.
 * This code's full epic context is the Manage flow for categories/tags/presets with quick navigation to create
 * transactions and clear structure for future epics like budgets and reports.
 * This code's ui feel is minimal, modern, and responsive, using subtle shadows, rounded elements, and primary color
 * accents while respecting theme tokens (bg-background, text-foreground, primary, etc.).
 */

import Link from 'next/link'
import { Separator } from '@/components/ui/separator'

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#manage-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 bg-primary text-primary-foreground px-3 py-2 rounded-md"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to Dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="hidden sm:inline">Back</span>
            </Link>

            <div className="flex-1 text-center">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight">Manage</h1>
            </div>

            <Link
              href="/transactions/new"
              className="inline-flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 rounded-md transition-colors"
              aria-label="Create New Transaction"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M10 4.5V15.5M4.5 10H15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="hidden sm:inline">New</span>
            </Link>
          </div>

          <div className="pb-3">
            <nav aria-label="Manage sections" className="w-full">
              <ul
                role="tablist"
                className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-muted text-sm"
              >
                <li role="presentation">
                  <Link
                    role="tab"
                    href="/categories"
                    className="block w-full text-center rounded-md px-3 py-2 font-medium text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                    aria-label="Categories"
                  >
                    Categories
                  </Link>
                </li>
                <li role="presentation">
                  <Link
                    role="tab"
                    href="/tags"
                    className="block w-full text-center rounded-md px-3 py-2 font-medium text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                    aria-label="Tags"
                  >
                    Tags
                  </Link>
                </li>
                <li role="presentation">
                  <Link
                    role="tab"
                    href="/presets"
                    className="block w-full text-center rounded-md px-3 py-2 font-medium text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                    aria-label="Presets"
                  >
                    Presets
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
        <Separator />
      </header>

      <main id="manage-content" className="max-w-3xl mx-auto px-4 py-4 sm:py-6">
        {children}
      </main>

      <footer className="max-w-3xl mx-auto px-4 pb-6 text-center text-xs text-muted-foreground">
        <p className="leading-relaxed">
          Organized tools for quick entry and clean data. Adjust categories, tags, and presets here.
        </p>
      </footer>
    </div>
  )
}
