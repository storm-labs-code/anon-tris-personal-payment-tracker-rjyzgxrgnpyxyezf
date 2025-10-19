/**
 * CODE INSIGHT
 * This code's use case is to render the landing page for Tris with a welcoming hero and a clear call-to-action to navigate to Backup & Export settings.
 * This code's full epic context is the Backup & Export flow, serving as a starting point for users to access export, backup, and restore features in a mobile-first PWA.
 * This code's ui feel is calm, modern, and minimal with primary-blue accents, responsive layout, and subtle interactions, focusing on clarity and trust.
 */

import Link from 'next/link'
import { supabaseServer } from '@/utils/supabase/client-server'
import ClientLanding from './client'

export default async function Page() {
  let initialName: string | null = null
  let initialTransactionCount: number | null = null

  try {
    const { data: userData } = await supabaseServer.auth.getUser()
    const user = userData?.user || null

    if (user) {
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      initialName = profile?.full_name ?? null

      const { count } = await supabaseServer
        .from('transactions')
        .select('*', { head: true, count: 'exact' })
        .eq('user_id', user.id)

      initialTransactionCount = typeof count === 'number' ? count : null
    }
  } catch (_) {
    // Fail silently to keep landing page functional without auth.
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-10">
        <div className="relative z-10 flex flex-col gap-4 sm:gap-6">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Tris — Personal Payment Tracker
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Track your daily payments in KRW, keep receipts safe, and stay in control. Create backups, export data, and restore when needed — securely synced with Supabase.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/settings/backup"
              className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow transition-transform duration-150 hover:scale-[1.02] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Go to Backup & Export
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Open Settings
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl sm:-right-16 sm:-top-16 sm:h-72 sm:w-72" />
      </section>

      <ClientLanding initialName={initialName} initialTransactionCount={initialTransactionCount} />

      <section className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2">
        <Link href="/settings/backup" className="group rounded-xl border bg-card p-5 transition hover:bg-accent/50">
          <div className="flex items-start gap-4">
            <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2-2h7l2 2h5a2 2 0 0 1 2 2v3H3V5Zm0 6h20v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Zm6 3v2h10v-2H9Z"/></svg>
            </div>
            <div>
              <h3 className="text-base font-semibold">Export transactions (CSV)</h3>
              <p className="text-muted-foreground mt-1 text-sm">Download a clean CSV for analysis or sharing. KRW-friendly formatting.</p>
            </div>
          </div>
        </Link>
        <Link href="/settings/backup" className="group rounded-xl border bg-card p-5 transition hover:bg-accent/50">
          <div className="flex items-start gap-4">
            <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Zm0-8h5v2H8V9Z"/></svg>
            </div>
            <div>
              <h3 className="text-base font-semibold">Download receipts (ZIP)</h3>
              <p className="text-muted-foreground mt-1 text-sm">Grab your receipt images in one archive with a simple manifest.</p>
            </div>
          </div>
        </Link>
        <Link href="/settings/backup" className="group rounded-xl border bg-card p-5 transition hover:bg-accent/50">
          <div className="flex items-start gap-4">
            <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm1 1v8h6v-2h-4V4h-2Z"/></svg>
            </div>
            <div>
              <h3 className="text-base font-semibold">Create full backup (.zip)</h3>
              <p className="text-muted-foreground mt-1 text-sm">Data JSON + optional receipts, ready to restore later.</p>
            </div>
          </div>
        </Link>
        <Link href="/settings/backup" className="group rounded-xl border bg-card p-5 transition hover:bg-accent/50">
          <div className="flex items-start gap-4">
            <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5v6h6v2H10V5h2Zm8 12H4v-2h16v2Z"/></svg>
            </div>
            <div>
              <h3 className="text-base font-semibold">Restore from backup</h3>
              <p className="text-muted-foreground mt-1 text-sm">Validate a backup and restore with merge or replace.</p>
            </div>
          </div>
        </Link>
      </section>
    </main>
  )
}
