/**
 * CODE INSIGHT
 * This code's use case is to render the Settings index page with a clean, mobile-first list of available settings entries.
 * This code's full epic context is to guide the user to Backup & Export functionality as part of Tris’s data export/backup/restore flows.
 * This code's ui feel is calm, confident, and minimal—with a modern card list, clear labels, and soft interactions—no headers/footers here since layout provides them.
 */

import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import SettingsClient from './client'

export default async function SettingsPage() {
  const items = [
    {
      title: 'Backup & Export',
      description: 'Export CSV, download receipts, create backups, and restore data.',
      href: '/settings/backup',
      icon: 'archive',
    },
  ] as const

  return (
    <div className="w-full">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your Tris preferences and data tools.</p>
          </div>
          <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">Home</Link>
        </div>

        <Alert className="mt-6 border border-primary/20 bg-primary/5">
          <AlertTitle className="text-sm font-semibold">Your data is private and secure</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            Tris syncs your data using Supabase with your account only. Exports and backups download directly to your device.
          </AlertDescription>
        </Alert>

        <Separator className="my-6" />

        <section aria-label="Settings list" className="space-y-3">
          <SettingsClient items={items as any} />
        </section>

        <div className="mt-8 rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Looking for data tools? Start with <Link href="/settings/backup" className="text-primary underline-offset-4 hover:underline">Backup & Export</Link> to create a full backup or export your transactions.
          </p>
        </div>
      </div>
    </div>
  )
}
