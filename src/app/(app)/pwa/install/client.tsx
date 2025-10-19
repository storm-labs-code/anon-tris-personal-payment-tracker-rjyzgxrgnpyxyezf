'use client'

/**
 * CODE INSIGHT
 * This client widget detects PWA install support, captures beforeinstallprompt, and lets users trigger the install flow.
 * It provides a status check and live feedback, integrating subtly with the app shell behavior described in the epic.
 * UI is minimal, mobile-first, and uses Tailwind transitions for polished interactions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/utils/utils'
import { recordInstallAttempt } from './action'

// Minimal type for the BIP event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function InstallWidget() {
  const router = useRouter()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [checking, setChecking] = useState(false)
  const [supportChecked, setSupportChecked] = useState(false)
  const [supportSummary, setSupportSummary] = useState<string>('')
  const [outcome, setOutcome] = useState<'accepted' | 'dismissed' | 'unknown'>('unknown')
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const statusLiveRef = useRef<HTMLDivElement | null>(null)

  const platform = useMemo(() => {
    if (typeof navigator === 'undefined') return 'unknown'
    const ua = navigator.userAgent || ''
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
    if (/Android/.test(ua)) return 'android'
    if (/Windows/.test(ua) || /Macintosh/.test(ua) || /Linux x86_64/.test(ua)) return 'desktop'
    return 'unknown'
  }, [])

  const displayMode = useMemo(() => {
    if (typeof window === 'undefined') return 'browser'
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
    // iOS Safari
    const isIOSStandalone = (window.navigator as any).standalone === true
    return isStandalone || isIOSStandalone ? 'standalone' : 'browser'
  }, [])

  const runCheck = useCallback(() => {
    setChecking(true)
    try {
      const hasBIP = typeof window !== 'undefined' && 'onbeforeinstallprompt' in window
      const isStandalone = displayMode === 'standalone'
      setInstalled(isStandalone)
      const summary = [
        `Install prompt API: ${hasBIP ? 'available' : 'not available'}`,
        `Display mode: ${displayMode}`,
        `Network: ${isOnline ? 'online' : 'offline'}`,
      ].join(' • ')
      setSupportSummary(summary)
      setSupportChecked(true)
    } finally {
      setChecking(false)
    }
  }, [displayMode, isOnline])

  const attemptInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await recordInstallAttempt('install_button')
    // Prompt the user
    await deferredPrompt.prompt()
    try {
      const choice = await deferredPrompt.userChoice
      setOutcome(choice.outcome)
      // Clear saved prompt once used
      setDeferredPrompt(null)
      // Re-check install state after a brief delay to allow OS to finish
      setTimeout(runCheck, 800)
    } catch {
      setOutcome('unknown')
    }
  }, [deferredPrompt, runCheck])

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setOutcome('unknown')
    }
    const onAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setOutcome('accepted')
      // Soft refresh to allow app shell to apply standalone class if needed
      setTimeout(() => router.refresh(), 300)
    }
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', onAppInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Initial check
    runCheck()

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', onAppInstalled)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [router, runCheck])

  const InstallCTA = (
    <a
      href="#"
      onClick={async (e) => {
        e.preventDefault()
        if (deferredPrompt) {
          await attemptInstall()
        }
      }}
      aria-disabled={!deferredPrompt}
      className={cn(
        'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        deferredPrompt
          ? 'bg-primary text-primary-foreground shadow-sm hover:scale-[1.02]'
          : 'cursor-not-allowed bg-muted text-muted-foreground'
      )}
    >
      {deferredPrompt ? 'Install Tris' : 'Install not available yet'}
    </a>
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4">
        {installed ? (
          <Alert className="border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400">
            <AlertTitle>Already installed</AlertTitle>
            <AlertDescription>
              Tris is installed. Open it from your Home Screen or app launcher for the best experience.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Install for a faster experience</AlertTitle>
            <AlertDescription>
              Install Tris as a PWA to get offline access, quicker launches, and a clean, app-like interface.
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {InstallCTA}
          <button
            type="button"
            onClick={runCheck}
            disabled={checking}
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              checking && 'opacity-75'
            )}
          >
            {checking ? 'Checking…' : supportChecked ? 'Re-check' : 'Check install support'}
          </button>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs',
              isOnline ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-700'
            )}
            aria-live="polite"
          >
            <span className={cn('h-2 w-2 rounded-full', isOnline ? 'bg-emerald-500' : 'bg-amber-500')} />
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div ref={statusLiveRef} aria-live="polite" className="sr-only">
          {outcome !== 'unknown' ? `Install prompt ${outcome}` : ''}
        </div>

        {supportChecked && (
          <div className="mt-4 text-sm text-muted-foreground">
            <div className="rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', installed ? 'bg-emerald-500' : 'bg-blue-500')} />
                <span>Platform: {platform}</span>
              </div>
              <Separator className="my-3" />
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <span className={cn('h-1.5 w-1.5 rounded-full', deferredPrompt ? 'bg-emerald-500' : 'bg-rose-500')} />
                  Install prompt: {deferredPrompt ? 'ready' : 'not available yet'}
                </li>
                <li className="flex items-center gap-2">
                  <span className={cn('h-1.5 w-1.5 rounded-full', installed ? 'bg-emerald-500' : 'bg-slate-400')} />
                  Installed: {installed ? 'yes' : 'no'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  {supportSummary}
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Tips</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              If you don't see the Install option, try visiting this page in Chrome, Edge, or Safari and ensure you've visited a few pages.
            </p>
          </div>
          <Link
            href="/offline"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Offline help
          </Link>
        </div>
      </div>
    </div>
  )
}
