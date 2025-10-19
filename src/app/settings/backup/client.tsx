'use client'

/**
 * CODE INSIGHT
 * This code's use case is to provide the interactive UI for exporting CSVs, downloading receipts, creating manual backups, and restoring from backup archives.
 * This code's full epic context is the single-user Tris PWA settings page for data portability: export ranges, include receipts, validate/restore backups via API endpoints.
 * This code's ui feel is modern, minimal, mobile-first with clear grouping, inline validation, and smooth disabled/loading states.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

type ValidateResponse = {
  valid: boolean
  counts?: Partial<Record<'transactions' | 'receipts' | 'categories' | 'tags' | 'presets' | 'budgets' | 'recurring' | 'settings', number>>
  warnings?: string[]
  code?: string
  message?: string
}

type RestoreResponse = {
  ok?: boolean
  imported?: Partial<Record<'transactions' | 'receipts' | 'categories' | 'tags' | 'presets' | 'budgets' | 'recurring' | 'settings', number>>
  code?: string
  message?: string
}

export default function Client() {
  const router = useRouter()

  const [useAllData, setUseAllData] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [includeReceipts, setIncludeReceipts] = useState(true)

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pending, setPending] = useState<null | 'export-csv' | 'export-receipts' | 'backup' | 'validate' | 'restore'>(null)

  const [toastMsg, setToastMsg] = useState<{ type: 'info' | 'success' | 'error'; title?: string; message: string } | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge')
  const [validateResult, setValidateResult] = useState<ValidateResponse | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const isAnyDisabled = useMemo(() => !isOnline || pending !== null, [isOnline, pending])

  const rangeError = useMemo(() => {
    if (useAllData) return ''
    if (!startDate || !endDate) return 'Please select both start and end dates.'
    if (new Date(startDate) > new Date(endDate)) return 'Start date must be before or equal to end date.'
    return ''
  }, [useAllData, startDate, endDate])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (toastMsg) {
      const t = setTimeout(() => setToastMsg(null), 4200)
      return () => clearTimeout(t)
    }
  }, [toastMsg])

  const buildRangeQuery = useCallback(() => {
    if (useAllData) return ''
    const params = new URLSearchParams()
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [useAllData, startDate, endDate])

  const startDownload = useCallback((url: string, kind: 'export-csv' | 'export-receipts' | 'backup') => {
    if (!isOnline || pending) return
    setPending(kind)
    setToastMsg({ type: 'info', title: 'Preparing download', message: 'Download should begin shortly.' })

    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = url
    document.body.appendChild(iframe)

    // After a brief moment, clear pending state. Actual download is handled by the browser due to Content-Disposition.
    setTimeout(() => {
      try {
        document.body.removeChild(iframe)
      } catch {}
      setPending(null)
      setToastMsg({ type: 'success', title: 'Download started', message: 'If your download didn\'t start, please try again.' })
    }, 1500)
  }, [isOnline, pending])

  const onExportCSV = useCallback(() => {
    if (rangeError) return
    const qs = buildRangeQuery()
    const url = `/api/export/csv${qs}`
    startDownload(url, 'export-csv')
  }, [buildRangeQuery, startDownload, rangeError])

  const onDownloadReceipts = useCallback(() => {
    if (rangeError) return
    const qs = buildRangeQuery()
    const url = `/api/export/receipts${qs}`
    startDownload(url, 'export-receipts')
  }, [buildRangeQuery, startDownload, rangeError])

  const onCreateBackup = useCallback(() => {
    if (rangeError) return
    const params = new URLSearchParams()
    if (!useAllData) {
      if (startDate) params.set('start', startDate)
      if (endDate) params.set('end', endDate)
    }
    params.set('includeReceipts', includeReceipts ? 'true' : 'false')
    const url = `/api/backup/create?${params.toString()}`
    startDownload(url, 'backup')
  }, [rangeError, includeReceipts, useAllData, startDate, endDate, startDownload])

  const onValidate = useCallback(async () => {
    if (!selectedFile) {
      setToastMsg({ type: 'error', title: 'No file selected', message: 'Choose a .zip backup file to validate.' })
      return
    }
    if (!isOnline) return
    setPending('validate')
    setValidateResult(null)
    setRestoreError(null)

    const fd = new FormData()
    fd.append('file', selectedFile)

    try {
      const res = await fetch('/api/backup/restore/validate', { method: 'POST', body: fd })
      const json: ValidateResponse = await res.json()
      if (!res.ok) {
        setValidateResult(json)
        setToastMsg({ type: 'error', title: 'Validation failed', message: json.message || 'Please try again.' })
      } else {
        setValidateResult(json)
        if (json.valid) {
          setToastMsg({ type: 'success', title: 'Backup is valid', message: 'You can proceed to restore.' })
        } else {
          setToastMsg({ type: 'error', title: 'Invalid backup', message: json.message || 'Please review warnings and try again.' })
        }
      }
    } catch (e) {
      setValidateResult({ valid: false, message: 'Network error during validation.' })
      setToastMsg({ type: 'error', title: 'Network error', message: 'Please check your connection and try again.' })
    } finally {
      setPending(null)
    }
  }, [selectedFile, isOnline])

  const normalizeCounts = (data?: Partial<Record<string, number>>) => {
    return {
      transactions: data?.transactions ?? 0,
      receipts: data?.receipts ?? 0,
      categories: data?.categories ?? 0,
      tags: data?.tags ?? 0,
      presets: data?.presets ?? 0,
      budgets: data?.budgets ?? (data?.category_budgets ?? 0),
      recurring: data?.recurring ?? (data?.recurring_transactions ?? 0),
      settings: data?.settings ?? (data?.user_settings ?? 0),
    }
  }

  const onRestore = useCallback(async () => {
    if (!selectedFile) {
      setToastMsg({ type: 'error', title: 'No file selected', message: 'Choose a .zip backup file to restore.' })
      return
    }
    if (!isOnline) return

    setPending('restore')
    setRestoreError(null)

    const fd = new FormData()
    fd.append('file', selectedFile)
    fd.append('mergeMode', mergeMode)

    try {
      const res = await fetch('/api/backup/restore', { method: 'POST', body: fd })
      const json: RestoreResponse = await res.json()

      if (!res.ok || !json.ok) {
        const code = json.code || 'RESTORE_FAILED'
        setRestoreError(json.message || 'Restore failed. See error details.')
        setToastMsg({ type: 'error', title: 'Restore failed', message: json.message || 'Please review the error and try again.' })
        router.push(`/settings/backup/restore/error?code=${encodeURIComponent(code)}`)
        return
      }

      const counts = normalizeCounts(json.imported)
      const params = new URLSearchParams()
      params.set('mode', mergeMode)
      params.set('transactions', String(counts.transactions))
      params.set('receipts', String(counts.receipts))
      params.set('categories', String(counts.categories))
      params.set('tags', String(counts.tags))
      params.set('presets', String(counts.presets))
      params.set('budgets', String(counts.budgets))
      params.set('recurring', String(counts.recurring))

      setToastMsg({ type: 'success', title: 'Restore complete', message: 'Your data has been imported.' })
      router.push(`/settings/backup/restore/success?${params.toString()}`)
    } catch (e) {
      setRestoreError('Network error during restore. Please try again.')
      setToastMsg({ type: 'error', title: 'Network error', message: 'Please check your connection and retry.' })
      router.push('/settings/backup/restore/error?code=NETWORK_ERROR')
    } finally {
      setPending(null)
    }
  }, [selectedFile, mergeMode, isOnline, router])

  const resetFile = useCallback(() => {
    setSelectedFile(null)
    setValidateResult(null)
    setRestoreError(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Global banners */}
      <div className="space-y-3" aria-live="polite">
        {!isOnline && (
          <Alert variant="destructive" className="border-destructive/30">
            <AlertTitle>Offline</AlertTitle>
            <AlertDescription>Some actions are disabled until you\'re back online.</AlertDescription>
          </Alert>
        )}

        {toastMsg && (
          <Alert
            variant={toastMsg.type === 'error' ? 'destructive' : 'default'}
            className="border border-border"
          >
            {toastMsg.title && <AlertTitle>{toastMsg.title}</AlertTitle>}
            <AlertDescription>{toastMsg.message}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Date Range & Export */}
      <section className="bg-card border rounded-2xl shadow-sm">
        <div className="p-5">
          <h2 className="text-lg font-medium">Date range</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose a date range or export all data.</p>
        </div>
        <Separator />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="useAllData"
              type="checkbox"
              checked={useAllData}
              onChange={(e) => setUseAllData(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary ring-offset-background focus:ring-2 focus:ring-primary"
            />
            <label htmlFor="useAllData" className="text-sm select-none">Use all data</label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="start" className="text-sm text-muted-foreground">Start date</label>
              <input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={useAllData}
                className="h-11 rounded-md border bg-background px-3 text-sm shadow-sm outline-none transition disabled:opacity-60 focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="end" className="text-sm text-muted-foreground">End date</label>
              <input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={useAllData}
                className="h-11 rounded-md border bg-background px-3 text-sm shadow-sm outline-none transition disabled:opacity-60 focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {!!rangeError && !useAllData && (
            <p className="text-sm text-destructive">{rangeError}</p>
          )}
        </div>

        <Separator />
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={onExportCSV}
            disabled={isAnyDisabled || (!!rangeError && !useAllData)}
            className="inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary text-primary-foreground px-4 text-sm font-medium shadow transition hover:opacity-95 disabled:opacity-60"
          >
            {pending === 'export-csv' && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            )}
            Export transactions CSV
          </button>

          <button
            onClick={onDownloadReceipts}
            disabled={isAnyDisabled || (!!rangeError && !useAllData)}
            className="inline-flex items-center justify-center gap-2 h-11 rounded-md border bg-background px-4 text-sm font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
          >
            {pending === 'export-receipts' && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            )}
            Download receipts ZIP
          </button>
        </div>
      </section>

      {/* Manual Backup */}
      <section className="bg-card border rounded-2xl shadow-sm">
        <div className="p-5">
          <h2 className="text-lg font-medium">Manual backup</h2>
          <p className="text-sm text-muted-foreground mt-1">Create a .zip backup including your data and optionally receipts.</p>
        </div>
        <Separator />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="includeReceipts"
              type="checkbox"
              checked={includeReceipts}
              onChange={(e) => setIncludeReceipts(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary ring-offset-background focus:ring-2 focus:ring-primary"
            />
            <label htmlFor="includeReceipts" className="text-sm select-none">Include receipts</label>
          </div>

          <div className="pt-1">
            <button
              onClick={onCreateBackup}
              disabled={isAnyDisabled || (!!rangeError && !useAllData)}
              className="inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary text-primary-foreground px-4 text-sm font-medium shadow transition hover:opacity-95 disabled:opacity-60"
            >
              {pending === 'backup' && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              )}
              Create full backup (.zip)
            </button>
          </div>
        </div>
      </section>

      {/* Restore */}
      <section className="bg-card border rounded-2xl shadow-sm">
        <div className="p-5">
          <h2 className="text-lg font-medium">Restore from backup</h2>
          <p className="text-sm text-muted-foreground mt-1">Validate a backup and restore using merge or replace mode.</p>
        </div>
        <Separator />
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="backupFile" className="text-sm text-muted-foreground">Backup file (.zip)</label>
              <input
                id="backupFile"
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  setSelectedFile(f)
                  setValidateResult(null)
                  setRestoreError(null)
                }}
                className="h-11 rounded-md border bg-background px-3 text-sm shadow-sm outline-none transition file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-secondary/90"
              />
              {selectedFile && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{selectedFile.name}</span>
                  <button onClick={resetFile} className="text-foreground/80 hover:text-foreground underline underline-offset-2">Clear</button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Restore mode</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mergeMode"
                    value="merge"
                    checked={mergeMode === 'merge'}
                    onChange={() => setMergeMode('merge')}
                    className="h-4 w-4 rounded-full border-input text-primary focus:ring-2 focus:ring-primary"
                  />
                  Merge
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mergeMode"
                    value="replace"
                    checked={mergeMode === 'replace'}
                    onChange={() => setMergeMode('replace')}
                    className="h-4 w-4 rounded-full border-input text-primary focus:ring-2 focus:ring-primary"
                  />
                  Replace
                </label>
              </div>
              <p className="text-xs text-muted-foreground">Replace will delete your existing data before importing.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={onValidate}
              disabled={isAnyDisabled || !selectedFile}
              className="inline-flex items-center justify-center gap-2 h-11 rounded-md border bg-background px-4 text-sm font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
            >
              {pending === 'validate' && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              )}
              Validate backup
            </button>

            <button
              onClick={onRestore}
              disabled={isAnyDisabled || !selectedFile || (validateResult?.valid === false)}
              className={(mergeMode === 'replace'
                ? 'bg-destructive text-destructive-foreground hover:opacity-95'
                : 'bg-primary text-primary-foreground hover:opacity-95') + ' inline-flex items-center justify-center gap-2 h-11 rounded-md px-4 text-sm font-medium shadow transition disabled:opacity-60'}
            >
              {pending === 'restore' && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              )}
              Restore now
            </button>

            <Link
              href="/settings/backup/restore/error?code=HELP"
              className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Need help?
            </Link>
          </div>

          {validateResult && (
            <div className="mt-2 rounded-lg border p-4 bg-background/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">Validation summary</p>
                  <p className="text-sm text-muted-foreground">Schema and contents check results.</p>
                </div>
                <span className={'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium ' + (validateResult.valid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-destructive/10 text-destructive')}>{validateResult.valid ? 'Valid' : 'Invalid'}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 text-xs">
                {Object.entries({
                  Transactions: normalizeCounts(validateResult.counts).transactions,
                  Receipts: normalizeCounts(validateResult.counts).receipts,
                  Categories: normalizeCounts(validateResult.counts).categories,
                  Tags: normalizeCounts(validateResult.counts).tags,
                  Presets: normalizeCounts(validateResult.counts).presets,
                  Budgets: normalizeCounts(validateResult.counts).budgets,
                  Recurring: normalizeCounts(validateResult.counts).recurring,
                  Settings: normalizeCounts(validateResult.counts).settings,
                }).map(([k, v]) => (
                  <div key={k} className="rounded-md border bg-card p-3 text-center">
                    <div className="text-foreground/90 font-medium">{v}</div>
                    <div className="text-muted-foreground mt-1">{k}</div>
                  </div>
                ))}
              </div>

              {!!validateResult.warnings?.length && (
                <div className="mt-4">
                  <p className="text-sm font-medium">Warnings</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-amber-600 dark:text-amber-400 space-y-1">
                    {validateResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!validateResult.message && !validateResult.valid && (
                <div className="mt-4 text-sm text-destructive">{validateResult.message}</div>
              )}

              {!!restoreError && (
                <div className="mt-4 text-sm text-destructive">{restoreError}</div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Subtle info */}
      <p className="text-xs text-muted-foreground">
        Tip: For large exports, downloads may take a moment to prepare. Keep this tab open until the download begins.
      </p>
    </div>
  )
}
