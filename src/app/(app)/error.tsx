/**
 * CODE INSIGHT
 * This code's use case is to render a resilient, segment-level error UI within the App Shell.
 * This code's full epic context is the demo data flow using SWR; on failure, this boundary shows an accessible alert and offers quick recovery via retry (reset + refresh) and navigation options.
 * This code's ui feel is calm, minimal, mobile-first, with clear actions, subtle motion, and trusted feedback aligned to Tris's primary blue aesthetic.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/utils/utils'
import { ErrorActions } from './client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [isOffline, setIsOffline] = React.useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const title = isOffline ? 'You are offline' : 'Something went wrong'
  const description = isOffline
    ? 'This section could not load because your device appears to be offline. Reconnect and try again.'
    : "We couldn't load this section right now. Try again in a moment."

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <section aria-labelledby="app-error-title" className="relative">
        <Alert
          variant="destructive"
          role="alert"
          aria-live="assertive"
          className={cn(
            'rounded-xl border-destructive/40 bg-destructive/10 text-destructive shadow-sm backdrop-blur',
            'ring-1 ring-inset ring-destructive/10'
          )}
        >
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-destructive/15">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-destructive motion-safe:animate-pulse"
                fill="currentColor"
                focusable="false"
                aria-hidden="true"
              >
                <path d="M11 7h2v6h-2V7zm0 8h2v2h-2v-2z" />
                <path d="M1 21h22L12 2 1 21z" />
              </svg>
            </span>
            <div className="flex-1">
              <AlertTitle id="app-error-title" className="text-base font-semibold">
                {title}
              </AlertTitle>
              <AlertDescription className="mt-1 text-sm text-foreground/80">
                {description}
              </AlertDescription>

              <div className="mt-4">
                <ErrorActions
                  onReset={() => reset()}
                  onBack={() => router.back()}
                  digest={error?.digest}
                  isOffline={isOffline}
                />
              </div>

              <div className="mt-3">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium',
                        'text-foreground/70 hover:text-foreground transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2'
                      )}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path
                          d="M12 7l-5 5h10l-5-5zm0 10l5-5H7l5 5z"
                          fill="currentColor"
                        />
                      </svg>
                      Technical details
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="max-h-60 overflow-auto rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                      {error?.message && (
                        <div className="mb-2 whitespace-pre-wrap">
                          <span className="font-semibold text-foreground">Message: </span>
                          {error.message}
                        </div>
                      )}
                      {error?.digest && (
                        <div className="mb-2">
                          <span className="font-semibold text-foreground">Digest: </span>
                          <code className="rounded bg-background/60 px-1 py-0.5">{error.digest}</code>
                        </div>
                      )}
                      {error?.stack && (
                        <details>
                          <summary className="cursor-pointer select-none text-foreground">Stack trace</summary>
                          <pre className="mt-1 whitespace-pre-wrap break-words">{error.stack}</pre>
                        </details>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </div>
        </Alert>

        <nav aria-label="Quick links" className="mt-6">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/"
              className={cn(
                'flex-1 rounded-lg border border-input bg-background px-4 py-2 text-center text-sm font-medium text-foreground shadow-sm',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2'
              )}
            >
              Home
            </Link>
            <Link
              href="/transactions"
              className={cn(
                'flex-1 rounded-lg border border-input bg-background px-4 py-2 text-center text-sm font-medium text-foreground shadow-sm',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2'
              )}
            >
              Transactions
            </Link>
            <Link
              href="/reports"
              className={cn(
                'flex-1 rounded-lg border border-input bg-background px-4 py-2 text-center text-sm font-medium text-foreground shadow-sm',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2'
              )}
            >
              Reports
            </Link>
            <Link
              href="/settings"
              className={cn(
                'flex-1 rounded-lg border border-input bg-background px-4 py-2 text-center text-sm font-medium text-foreground shadow-sm',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2'
              )}
            >
              Settings
            </Link>
            {isOffline && (
              <Link
                href="/offline"
                className={cn(
                  'col-span-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-center text-sm font-medium text-yellow-800 shadow-sm',
                  'hover:bg-yellow-500/20 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/60 focus-visible:ring-offset-2'
                )}
              >
                Offline help
              </Link>
            )}
          </div>
        </nav>
      </section>
    </div>
  )
}
