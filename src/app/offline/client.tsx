'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function OfflineClient() {
  const router = useRouter()
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [lastTriedAt, setLastTriedAt] = useState<Date | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const update = () => setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : null)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  async function checkConnectivity() {
    setChecking(true)
    setMessage(null)
    setLastTriedAt(new Date())

    try {
      // Try a fast health check with timeout
      abortRef.current = new AbortController()
      const to = setTimeout(() => abortRef.current?.abort(), 6000)
      const res = await fetch('/api/health', { cache: 'no-store', signal: abortRef.current.signal })
      clearTimeout(to)
      if (res.ok) {
        setMessage('Connection restored. Reloading…')
        // Small delay for UX feedback then refresh to resume normal navigation
        setTimeout(() => {
          router.refresh()
          // ensure full reload in case of SW-controlled offline cache
          window.location.reload()
        }, 500)
        return
      }
      setMessage('Still offline or server unavailable. Please try again.')
    } catch (err) {
      // Network error or aborted -> still offline
      setMessage('No connection detected. Check your network and try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-5">
      <Alert className="border-destructive/40 bg-destructive/10">
        <AlertTitle className="flex items-center gap-2">
          <span className={`inline-flex size-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-destructive'} ${isOnline === null ? 'opacity-60' : ''}`}></span>
          {isOnline ? 'Online detected locally' : 'Offline detected'}
        </AlertTitle>
        <AlertDescription className="mt-1 text-sm">
          {isOnline
            ? 'Your device reports an internet connection, but this page was served offline. Try reloading.'
            : 'Your device appears to be offline. We’ll reconnect automatically when back online.'}
        </AlertDescription>
      </Alert>

      {message && (
        <div role="status" aria-live="polite" className="text-sm rounded-lg border border-border bg-muted/30 px-3 py-2">
          {message}
          {lastTriedAt && (
            <span className="text-muted-foreground"> · {lastTriedAt.toLocaleTimeString()}</span>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={checkConnectivity}
          disabled={checking}
          className={`inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {checking ? (
            <span className="inline-flex items-center gap-2">
              <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Checking…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M2 8.5C5.5 6 8.5 5 12 5s6.5 1 10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M5 12c2.3-1.5 4.5-2 7-2s4.7.5 7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8.5 15.5c1-.7 2-.9 3.5-.9s2.5.2 3.5.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Retry connection
            </span>
          )}
        </button>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
