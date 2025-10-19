/**
 * CODE INSIGHT
 * This code's use case is to render the Backup & Export main content area, delegating interactivity to a client component.
 * This code's full epic context is the Settings > Backup flow for exporting CSV, downloading receipts, creating manual backups, and restoring from backups via API endpoints.
 * This code's ui feel is clean, modern, and mobile-first with calm, confident interactions matching Tris’s design system.
 */

import Link from 'next/link'
import Client from './client'

export default async function Page() {
  return (
    <div className="w-full">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Settings
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Backup & Export</h1>
          <p className="text-muted-foreground mt-1">Export your data, download receipts, or restore from a backup archive.</p>
        </div>

        <Client />
      </div>
    </div>
  )
}
