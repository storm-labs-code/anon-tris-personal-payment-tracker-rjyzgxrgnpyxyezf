/**
 * CODE INSIGHT
 * This code's use case is the shared App Shell sub-layout for all signed-in app pages under the (app) group.
 * This code's full epic context is to provide a consistent mobile-first header, persistent bottom tab navigation,
 * and a floating action button to add transactions, while remaining server-only as per project rules. It prepares
 * landmarks, skip link, and accessible structure so client pages can hydrate with SWR and other client logic.
 * This code's ui feel is calm, modern, and thumb-friendly with large touch targets, subtle elevation, and
 * accessible contrast using the design token classes.
 */

import React from 'react'
import Link from 'next/link'
import { cn } from '@/utils/utils'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Skip to content for accessibility */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-2 focus:left-2 focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground shadow"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background/90 border-b border-border">
        <div className="mx-auto max-w-screen-md px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" prefetch className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <span className="font-semibold text-base sm:text-lg tracking-tight">Tris</span>
            </Link>
            {/* Live region for downstream pages to update via their own headings if needed */}
            <span
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              App
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/pwa/install"
              prefetch
              className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:opacity-90 transition"
              aria-label="Install app"
            >
              <InstallIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Install</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main
        id="main"
        role="main"
        tabIndex={-1}
        className="flex-1 mx-auto w-full max-w-screen-md px-3 sm:px-6 py-4 pb-28"
      >
        {children}
      </main>

      {/* Floating Action Button */}
      <div
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40"
        aria-hidden={false}
      >
        <Link
          href="/transactions/new"
          prefetch
          className={cn(
            'group inline-flex items-center justify-center h-14 w-14 rounded-full shadow-xl',
            'bg-primary text-primary-foreground hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'transition transform active:scale-95'
          )}
          aria-label="Add transaction"
        >
          <PlusIcon className="h-6 w-6" />
        </Link>
      </div>

      {/* Bottom Tab Bar */}
      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      >
        <div
          className="mx-auto max-w-screen-md"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <ul className="grid grid-cols-4">
            <li>
              <TabLink href="/" label="Home">
                <HomeIcon className="h-5 w-5" />
              </TabLink>
            </li>
            <li>
              <TabLink href="/transactions" label="Transactions">
                <ListIcon className="h-5 w-5" />
              </TabLink>
            </li>
            <li>
              <TabLink href="/reports" label="Reports">
                <ChartIcon className="h-5 w-5" />
              </TabLink>
            </li>
            <li>
              <TabLink href="/settings" label="Settings">
                <SettingsIcon className="h-5 w-5" />
              </TabLink>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  )
}

function TabLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch
      className={cn(
        'flex flex-col items-center justify-center gap-1 py-3',
        'text-sm text-muted-foreground hover:text-foreground transition-colors'
      )}
    >
      <span aria-hidden>{children}</span>
      <span className="text-[11px] leading-none">{label}</span>
    </Link>
  )
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" className="fill-primary/15" />
      <path d="M7 15.5c2.5-1.5 4-4.5 5-8 1.5 4 3 6.5 5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="15.5" r="1.25" className="fill-primary" />
      <circle cx="17" cy="15.5" r="1.25" className="fill-primary" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <rect x="4" y="6" width="16" height="2" rx="1" className="fill-current" />
      <rect x="4" y="11" width="16" height="2" rx="1" className="fill-current" />
      <rect x="4" y="16" width="10" height="2" rx="1" className="fill-current" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path d="M4 19V5M9 19v-8M14 19v-4M19 19v-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M19.4 15a7.97 7.97 0 0 0 .1-2l2.1-1.6-2-3.5-2.5.6a8 8 0 0 0-1.7-1l-.4-2.6H9l-.4 2.6a8 8 0 0 0-1.7 1l-2.5-.6-2 3.5L4.5 13a8 8 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-.6c.52.4 1.1.74 1.7 1l.4 2.6h4.8l.4-2.6c.6-.26 1.18-.6 1.7-1l2.5.6 2-3.5L19.4 15Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function InstallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="5" y="14" width="14" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
