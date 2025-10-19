/**
 * CODE INSIGHT
 * This code's use case is to provide a reusable sub-layout specifically for the Settings section.
 * This code's full epic context is to wrap all /settings pages with a sticky header, a simple back button to the dashboard (/), and a persistent bottom navigation linking to key areas (Home, Settings, Backup & Export) without adding any API logic.
 * This code's ui feel is calm, minimal, mobile-first, with subtle transparency and blur, ample touch targets, and accessible labels. It uses Tailwind utility classes and theme tokens for a cohesive look in light/dark themes.
 */

import React from 'react'
import Link from 'next/link'
import { cn } from '@/utils/utils'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Sticky Header */}
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-border',
          'bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back to Home"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-border bg-card text-card-foreground',
              'hover:bg-accent hover:text-accent-foreground transition-colors px-3 py-2'
            )}
          >
            {/* Arrow Left Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M10.5 6.75 4.75 12l5.75 5.25m-5.5-5.25H19.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-medium">Back</span>
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">Settings</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage your preferences, backup & restore</p>
          </div>

          {/* Contextual quick link to Backup & Export */}
          <Link
            href="/settings/backup"
            className={cn(
              'hidden xs:inline-flex items-center gap-2 rounded-lg border border-border bg-card text-card-foreground',
              'hover:bg-primary hover:text-primary-foreground transition-colors px-3 py-2 text-sm font-medium'
            )}
            aria-label="Go to Backup & Export"
          >
            {/* Archive/Zip Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M7 3.75h6.75A3.25 3.25 0 0 1 17 7v12.25H9.25A3.25 3.25 0 0 1 6 16V6.75A3 3 0 0 1 9 3.75" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 3.75V6h2.25V3.75" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="10" y="7.5" width="2.25" height="2" rx="0.5" fill="currentColor"/>
              <rect x="10" y="10.5" width="2.25" height="2" rx="0.5" fill="currentColor"/>
            </svg>
            <span>Backup</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 pt-4 pb-24">
          {children}
        </div>
      </main>

      {/* Persistent Bottom Navigation */}
      <nav
        className={cn(
          'fixed bottom-0 inset-x-0 z-40 border-t border-border',
          'bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="mx-auto w-full max-w-3xl grid grid-cols-3 h-16">
          <Link
            href="/"
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-xs font-medium',
              'text-muted-foreground hover:text-foreground transition-colors'
            )}
            aria-label="Home"
          >
            {/* Home Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path d="M3.75 10.5 12 3l8.25 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6.75 9.75V20.25h10.5V9.75" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span>Home</span>
          </Link>

          <Link
            href="/settings"
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-xs font-medium',
              'text-foreground'
            )}
            aria-current="page"
            aria-label="Settings"
          >
            {/* Settings/Gear Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path d="M12 9.25a2.75 2.75 0 1 0 0 5.5a2.75 2.75 0 0 0 0-5.5Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M19 10.5a7.51 7.51 0 0 1 0 3l2 1.25l-2 3.5l-2.25-.75a7.63 7.63 0 0 1-2.6 1.5L13.5 21h-3l-.65-2a7.63 7.63 0 0 1-2.6-1.5L5 18.25l-2-3.5L5 13.5a7.51 7.51 0 0 1 0-3L3 9.25l2-3.5L7.85 6a7.63 7.63 0 0 1 2.6-1.5L10.5 3h3l.65 2a7.63 7.63 0 0 1 2.6 1.5L19 5.75l2 3.5L19 10.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <span>Settings</span>
          </Link>

          <Link
            href="/settings/backup"
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-xs font-medium',
              'text-muted-foreground hover:text-foreground transition-colors'
            )}
            aria-label="Backup & Export"
          >
            {/* Download/Archive Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path d="M12 3.75v10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M8.75 11.5L12 14.75L15.25 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 20.25h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Backup</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
