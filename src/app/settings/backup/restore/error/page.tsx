/**
 * CODE INSIGHT
 * This code's use case is to present a clear, friendly error page when a backup restore fails.
 * This code's full epic context is the Backup & Export flow where users validate and restore backups; on failure, they are routed here with an error code and optional message for guidance and next steps.
 * This code's ui feel is calm, modern, and mobile-first, using card layouts, accessible alerts, and clear actions to retry or navigate back to Backup settings.
 */

import Link from 'next/link'
import { Suspense } from 'react'
import Client from './client'

function mapError(code?: string) {
  const known = {
    VALIDATION_FAILED: {
      title: 'Backup validation failed',
      description:
        'We could not validate the backup file. Please ensure you selected a valid Tris backup (.zip) exported from this app.'
    },
    UNAUTHORIZED: {
      title: 'You are not signed in',
      description:
        'Your session appears to have expired. Please sign in again and retry the restore.'
    },
    BAD_ARCHIVE: {
      title: 'Could not read the selected file',
      description:
        'The uploaded archive may be corrupted or not a supported ZIP file. Try re-downloading or exporting a new backup.'
    },
    UNSUPPORTED_SCHEMA: {
      title: 'Unsupported backup format',
      description:
        'This backup was created with an unsupported schema version. Update the app and try again.'
    },
    STORAGE_UPLOAD_FAILED: {
      title: 'Receipt upload failed',
      description:
        'We were unable to upload one or more receipt images. Check your connection and try again.'
    },
    DB_WRITE_FAILED: {
      title: 'Problem saving your data',
      description:
        'A database error occurred while importing your data. Please retry. If it persists, try using Merge mode.'
    },
    REPLACE_DELETE_FAILED: {
      title: 'Could not clear existing data',
      description:
        'Replace mode requires clearing your current data, but that step failed. Try Merge mode or retry Replace.'
    },
    TIMEOUT: {
      title: 'Restore timed out',
      description:
        'The restore took too long. Check your network connection and try again.'
    },
    NETWORK: {
      title: 'Network error during restore',
      description:
        'We lost connection while restoring. Ensure you are online and try again.'
    },
    UNKNOWN: {
      title: 'Unexpected error during restore',
      description:
        'Something went wrong. Please try again. If the issue continues, contact support with the details below.'
    }
  } as const

  const key = (code || 'UNKNOWN') as keyof typeof known
  return known[key] || known.UNKNOWN
}

export default function Page({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const codeParam = Array.isArray(searchParams?.code)
    ? searchParams.code[0]
    : searchParams?.code
  const msgParam = Array.isArray(searchParams?.msg)
    ? searchParams.msg[0]
    : searchParams?.msg

  const mapped = mapError(codeParam)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <Suspense>
        <Client
          code={codeParam}
          title={mapped.title}
          description={mapped.description}
          message={msgParam}
        />
      </Suspense>
      <div className="mt-8 text-sm text-muted-foreground">
        <p>
          Looking for another setting? Go back to{' '}
          <Link href="/settings" className="text-primary hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
