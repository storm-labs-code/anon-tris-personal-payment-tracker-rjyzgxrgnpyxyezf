'use client'

/**
 * CODE INSIGHT
 * Client UI for the restore error page: shows friendly messaging, technical details, and quick actions to retry.
 * Interactive behavior includes copying details, toggling advanced info, and navigating back to Backup & Export.
 * The UI is mobile-first, uses subtle motion, and maintains trust via clear labels and accessible components.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/utils/utils'

type Props = {
  code?: string
  title: string
  description: string
  message?: string
}

const troubleshootByCode: Record<string, string[]> = {
  VALIDATION_FAILED: [
    'Confirm the file is a Tris backup (.zip) and not another archive type.',
    'If you exported from another device, ensure the app is up-to-date on both.',
    'Try re-exporting the backup and validate again.'
  ],
  UNAUTHORIZED: [
    'Sign back in to your account.',
    'Return to Backup & Export and retry the restore.'
  ],
  BAD_ARCHIVE: [
    'Re-download or re-export the backup file.',
    'Ensure the file is not empty and try again.'
  ],
  UNSUPPORTED_SCHEMA: [
    'Update the app to the latest version.',
    'Export a new backup and retry.'
  ],
  STORAGE_UPLOAD_FAILED: [
    'Check your internet connection.',
    'Retry the restore. If it persists, try without receipts, then add receipts later.'
  ],
  DB_WRITE_FAILED: [
    'Retry the restore.',
    'If Replace mode failed, try Merge mode to avoid clearing data first.'
  ],
  REPLACE_DELETE_FAILED: [
    'Retry Replace mode after a moment.',
    'Alternatively, choose Merge mode.'
  ],
  TIMEOUT: [
    'Ensure a stable network connection.',
    'Retry the restore. Large backups may take longer.'
  ],
  NETWORK: [
    'Reconnect to the internet and try again.',
    'If on mobile data, ensure sufficient signal.'
  ],
  UNKNOWN: [
    'Retry the restore.',
    'If the issue continues, contact support with the details below.'
  ]
}

export default function Client({ code, title, description, message }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const details = useMemo(() => {
    const payload = {
      context: 'restore-error',
      code: code || 'UNKNOWN',
      message: message || '',
      timestamp: new Date().toISOString()
    }
    return JSON.stringify(payload, null, 2)
  }, [code, message])

  const steps = useMemo(() => troubleshootByCode[code || 'UNKNOWN'] || troubleshootByCode.UNKNOWN, [code])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (_) {
      // best-effort copy; ignore
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-destructive/15 text-destructive ring-8 ring-destructive/5">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="currentColor"
          >
            <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 14h-2v-2h2Zm0-4h-2V7h2Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Restore failed</h1>
          <p className="mt-1 text-muted-foreground">Please review the details below and try again.</p>
        </div>
      </div>

      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertTitle className="flex items-center justify-between gap-3">
          <span>{title}</span>
          <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium">{code || 'UNKNOWN'}</span>
        </AlertTitle>
        <AlertDescription className="mt-1 text-sm text-destructive">
          {description}
        </AlertDescription>
      </Alert>

      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-medium">Troubleshooting</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-primary"></span>
              <span>{s}</span>
            </li>
          ))}
        </ul>

        <Separator className="my-4" />

        <Collapsible defaultOpen={Boolean(message)}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Error details</h3>
              <p className="text-xs text-muted-foreground">Technical info for support or debugging</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onCopy}
                className={cn(
                  'inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium transition',
                  copied
                    ? 'border-green-600/20 bg-green-600/10 text-green-700'
                    : 'border-border bg-background hover:bg-muted'
                )}
                aria-label="Copy error details"
              >
                {copied ? 'Copied' : 'Copy details'}
              </button>
              <CollapsibleTrigger className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
                Toggle
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed text-foreground/90">
              {details}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="sticky bottom-4 z-10 -mb-2 mt-2 flex flex-col gap-3 sm:static sm:mb-0 sm:mt-2 sm:flex-row">
        <button
          onClick={() => router.push('/settings/backup')}
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto"
        >
          Return to Backup & Export
        </button>
        <button
          onClick={() => router.push('/settings')}
          className="inline-flex w-full items-center justify-center rounded-lg border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-auto"
        >
          Go to Settings
        </button>
      </div>
    </div>
  )
}
