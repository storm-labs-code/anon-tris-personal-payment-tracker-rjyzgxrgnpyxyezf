/**
 * CODE INSIGHT
 * This code's use case is to render an accessible error boundary UI for the Reports page.
 * This code's full epic context is the demo PWA flow where /reports fetches summary data via SWR, and on error this client error boundary should show a friendly alert with a retry action and a sensible navigation link back to Home.
 * This code's ui feel is calm, modern, mobile-first with clear CTAs, subtle micro-interactions, and strong accessibility (role="alert", focus management, offline hint).
 */

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    // Move focus to the error heading for screen readers
    headingRef.current?.focus()
  }, [])

  const hint = useMemo(() => {
    if (!isOnline) return 'You appear to be offline. Check your connection and try again.'
    return 'Something went wrong while loading your reports. You can retry or head back to the dashboard.'
  }, [isOnline])

  return (
    <section className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <Alert
        variant="destructive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="border-destructive/30 bg-destructive/10 text-destructive-foreground"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-destructive text-destructive-foreground/90 shadow-sm">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M11.001 3.003a1 1 0 0 1 1.998 0l.001 9.002a1 1 0 0 1-1 1h-.001a1 1 0 0 1-.998-1V3.003Zm.999 16.994a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <AlertTitle>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-base font-semibold tracking-tight outline-none sm:text-lg"
              >
                We couldn’t load your reports
              </h1>
            </AlertTitle>
            <AlertDescription className="mt-1 text-sm leading-relaxed">
              {hint}
              {!isOnline && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground align-middle">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                  </span>
                  Offline
                </span>
              )}
            </AlertDescription>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                Try again
              </button>
              <Link
                href="/"
                prefetch
                className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Go to Home
              </Link>
            </div>

            <Collapsible className="mt-4">
              <CollapsibleTrigger className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform"
                >
                  <path
                    fill="currentColor"
                    d="M12 15.5 6 9.5h12l-6 6Z"
                  />
                </svg>
                Show technical details
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 overflow-hidden rounded-md bg-muted/50 p-3 text-xs">
                <div className="space-y-1 font-mono text-muted-foreground">
                  <div className="truncate"><span className="font-semibold text-foreground">Message:</span> {error?.message || 'Unknown error'}</div>
                  {error?.digest && (
                    <div className="truncate"><span className="font-semibold text-foreground">Digest:</span> {error.digest}</div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </Alert>

      <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/transactions"
          prefetch
          className="group rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">View Transactions</p>
              <p className="mt-1 text-xs text-muted-foreground">Head to your list while we stabilize reports.</p>
            </div>
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            >
              <path fill="currentColor" d="M13.5 5 12.08 6.41 16.67 11H4v2h12.67l-4.59 4.59L13.5 19l7-7-7-7Z" />
            </svg>
          </div>
        </Link>
        <Link
          href="/settings"
          prefetch
          className="group rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Settings</p>
              <p className="mt-1 text-xs text-muted-foreground">Adjust theme and accessibility preferences.</p>
            </div>
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            >
              <path fill="currentColor" d="M13.5 5 12.08 6.41 16.67 11H4v2h12.67l-4.59 4.59L13.5 19l7-7-7-7Z" />
            </svg>
          </div>
        </Link>
      </div>
    </section>
  )
}
