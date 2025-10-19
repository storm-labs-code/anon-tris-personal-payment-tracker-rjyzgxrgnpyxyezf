/**
 * CODE INSIGHT
 * This code's use case is to render a resilient, accessible error boundary UI for the Transactions list route.
 * This code's full epic context is the demo data flow where SWR fetches /api/demo/transactions and on failure this component offers a retry that revalidates SWR caches and resets the segment, plus an offline pathway.
 * This code's ui feel is calm, minimal, and mobile-first with clear actions, subtle motion, and prominent trust signals.
 */
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/utils/utils'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { mutate } = useSWRConfig()
  const searchParams = useSearchParams()
  const [isOffline, setIsOffline] = React.useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )
  const [retrying, setRetrying] = React.useState(false)

  React.useEffect(() => {
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const handleRetry = async () => {
    try {
      setRetrying(true)
      const cursor = searchParams.get('cursor')
      // Revalidate any SWR keys related to transactions, optionally scoped by cursor
      await mutate(
        (key: any) =>
          Array.isArray(key) &&
          key[0] === 'transactions' &&
          (cursor ? key[1]?.cursor === cursor : true),
        undefined,
        { revalidate: true }
      )
    } finally {
      setRetrying(false)
      reset()
    }
  }

  const message = isOffline
    ? 'It looks like you are offline. Please reconnect and try again.'
    : 'We couldn\'t load your transactions right now. Please try again.'

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <section
        role="alert"
        aria-live="assertive"
        className={cn(
          'w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground shadow-lg',
          'p-4 sm:p-6'
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'shrink-0 rounded-full p-3',
              isOffline ? 'bg-muted' : 'bg-destructive/10'
            )}
            aria-hidden
          >
            {/* Exclamation Triangle Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={cn(
                'h-6 w-6',
                isOffline ? 'text-foreground/70' : 'text-destructive'
              )}
            >
              <path
                fillRule="evenodd"
                d="M9.401 1.937c1.155-2 4.043-2 5.198 0l8.593 14.889c1.154 2-.288 4.5-2.599 4.5H3.407c-2.311 0-3.753-2.5-2.599-4.5L9.401 1.937zM12 8a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1zm0 10a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="flex-1">
            <Alert className="border-0 p-0">
              <AlertTitle className="text-base sm:text-lg font-semibold tracking-tight">
                {isOffline ? 'You\'re offline' : 'Something went wrong'}
              </AlertTitle>
              <AlertDescription className="mt-1 text-sm text-muted-foreground">
                {message}
              </AlertDescription>
            </Alert>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className={cn(
                  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium',
                  'bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'transition-transform active:scale-[0.98]'
                )}
              >
                {retrying ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    Retrying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4"
                    >
                      <path d="M12 5v2.25a.75.75 0 001.28.53l2.72-2.72a.75.75 0 000-1.06L13.28.28A.75.75 0 0012 .81V3a9 9 0 109 9h-1.5A7.5 7.5 0 1112 5z" />
                    </svg>
                    Retry
                  </span>
                )}
              </button>

              <Link
                href="/offline"
                className={cn(
                  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium',
                  'bg-muted text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'transition-colors'
                )}
                prefetch={true}
              >
                Offline help
              </Link>
            </div>

            <div className="mt-3 text-xs text-muted-foreground/90">
              <p className="sr-only">Error details:</p>
              <div className="flex flex-col gap-1">
                {!isOffline && (
                  <span className="truncate">{error?.message ?? 'Unknown error'}</span>
                )}
                {error?.digest && (
                  <span className="opacity-70">Ref: {error.digest}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
