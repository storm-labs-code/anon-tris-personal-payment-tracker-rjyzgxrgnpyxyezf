'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getLandingSummary } from './action'

type Props = {
  initialName: string | null
  initialTransactionCount: number | null
}

export default function ClientLanding({ initialName, initialTransactionCount }: Props) {
  const router = useRouter()
  const [name, setName] = useState<string | null>(initialName)
  const [txCount, setTxCount] = useState<number | null>(initialTransactionCount)
  const [isPending, startTransition] = useTransition()
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 40)
    return () => clearTimeout(t)
  }, [])

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const res = await getLandingSummary()
        if (res?.ok) {
          setName(res.fullName ?? null)
          setTxCount(typeof res.transactionCount === 'number' ? res.transactionCount : null)
        }
      } catch (_) {
        // Silent, non-blocking on landing.
      }
    })
  }

  return (
    <section className={`mt-8 sm:mt-10 transition-all duration-500 ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Welcome{name ? `, ${name}` : ''}</h2>
              <p className="text-muted-foreground text-sm">{txCount !== null ? `${txCount} transaction${txCount === 1 ? '' : 's'} synced` : 'Signed-in status will personalize this view.'}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Refresh summary"
              disabled={isPending}
            >
              {isPending ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <Alert className="mt-4">
            <AlertTitle className="text-sm">Secure & private</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Your data is scoped to your account and can be exported or restored at any time. Backups include a manifest for integrity.
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
              PWA-ready
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
              KRW-focused
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              Offline-aware
            </span>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => router.push('/settings/backup')}
              className="group inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span>Backup & Export</span>
              <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 5l7 7-7 7v-4H4v-6h9V5z"/></svg>
            </button>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Open Settings
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-base font-semibold">What you can do</h3>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-primary" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
              </span>
              <span>Export CSV with a tap — perfect for spreadsheets and tax prep.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-primary" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 6 8h4v8h4V8h4z"/></svg>
              </span>
              <span>Download a ZIP of receipt images for safekeeping.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-primary" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3z"/></svg>
              </span>
              <span>Create a full backup archive with manifest and data.json.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-primary" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5v6H6v2h8V5zM4 17h16v2H4z"/></svg>
              </span>
              <span>Validate and restore backups with merge or replace.</span>
            </li>
          </ul>
          <div className="mt-5 text-xs text-muted-foreground">
            Tip: you can always return here after a restore to continue managing your data.
          </div>
        </div>
      </div>
    </section>
  )
}
