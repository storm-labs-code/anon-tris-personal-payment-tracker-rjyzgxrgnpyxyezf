'use client'

/**
 * CODE INSIGHT
 * This code's use case is to present and manage the local sync queue (IndexedDB via localForage):
 * Pending, Failed, Conflicts, and Completed items with retry/remove/preview controls.
 * This code's full epic context is the Offline-first Sync feature processing create/update/delete transactions
 * and receipt uploads against Supabase, with a SyncProvider elsewhere coordinating actual processing.
 * This code's ui feel is calm, reliable, and mobile-first with subtle motion, KRW-friendly, and clear status signals.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import localforage, { LocalForage } from 'localforage'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/utils/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

// Types reflecting the sync queue model from the Epic

type QueueType = 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'DELETE_TRANSACTION' | 'UPLOAD_RECEIPT'
type QueueStatus = 'pending' | 'processing' | 'error' | 'conflict' | 'done'

interface QueueRef {
  localId?: string
  remoteId?: string
}

interface QueueItem {
  id: string
  type: QueueType
  ref: QueueRef
  payload?: any
  baseVersion?: number | null
  status: QueueStatus
  error?: string | null
  createdAt?: number
  updatedAt?: number
}

interface SyncMetaState {
  pendingCount?: number
  lastSyncAt?: number | null
  isOnline?: boolean
  isSyncing?: boolean
}

interface ReceiptBlobEntry {
  blob: Blob
  mime?: string
  size?: number
  transactionRef?: { localId?: string; remoteId?: string }
}

const DB_NAME = 'tris'
const STORES = {
  queue: 'syncQueue',
  receipts: 'receipts',
  transactions: 'transactions',
  syncMeta: 'syncMeta',
  conflicts: 'conflicts',
}

function useLocalforageInstances() {
  const instances = useMemo(() => {
    const make = (storeName: string) => localforage.createInstance({ name: DB_NAME, storeName })
    return {
      queue: make(STORES.queue),
      receipts: make(STORES.receipts),
      transactions: make(STORES.transactions),
      syncMeta: make(STORES.syncMeta),
      conflicts: make(STORES.conflicts),
    }
  }, [])
  return instances
}

function formatTime(ts?: number | null) {
  if (!ts) return '-'
  try {
    return new Date(ts).toLocaleString('ko-KR', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch {
    return '-'
  }
}

function truncateId(id?: string) {
  if (!id) return '-'
  if (id.startsWith('local-')) return `${id.slice(0, 6)}…${id.slice(-4)}`
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

function actionLabel(t: QueueType) {
  switch (t) {
    case 'CREATE_TRANSACTION': return 'Create'
    case 'UPDATE_TRANSACTION': return 'Update'
    case 'DELETE_TRANSACTION': return 'Delete'
    case 'UPLOAD_RECEIPT': return 'Upload'
  }
}

function entityLabel(t: QueueType) {
  return t === 'UPLOAD_RECEIPT' ? 'Receipt' : 'Transaction'
}

export default function QueueClient() {
  const { queue, receipts, transactions, syncMeta } = useLocalforageInstances()
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [meta, setMeta] = useState<SyncMetaState>({ isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)
  const router = useRouter()

  // Setup BroadcastChannel for coordination with SyncProvider
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
    const bc = new BroadcastChannel('tris-sync')
    bcRef.current = bc
    const onMsg = (e: MessageEvent) => {
      const data = e.data || {}
      if (data?.type === 'QUEUE_UPDATED' || data?.type === 'SYNC_COMPLETED' || data?.type === 'SYNC_META_UPDATED') {
        void refresh()
      }
    }
    bc.addEventListener('message', onMsg)
    return () => {
      bc.removeEventListener('message', onMsg)
      bc.close()
      bcRef.current = null
    }
  }, [])

  // Online/offline listeners
  useEffect(() => {
    const onOnline = () => setMeta((m) => ({ ...m, isOnline: true }))
    const onOffline = () => setMeta((m) => ({ ...m, isOnline: false }))
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const refresh = useCallback(async () => {
    const list: QueueItem[] = []
    await queue.iterate<QueueItem, void>((value, key) => {
      if (!value) return
      const v = { ...value }
      if (!v.id) v.id = key as string
      list.push(v)
    })
    // Sort by createdAt ascending for deterministic listing within sections; done will be re-sorted
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    setItems(list)

    const metaState = await syncMeta.getItem<SyncMetaState>('state')
    setMeta((m) => ({ ...m, ...(metaState || {}) }))
  }, [queue, syncMeta])

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(() => void refresh(), 5000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(id)
    }
  }, [refresh])

  const triggerSync = useCallback(() => {
    if (bcRef.current) {
      try { bcRef.current.postMessage({ type: 'PROCESS_REQUEST' }) } catch {}
    }
  }, [])

  const retryItem = useCallback(async (item: QueueItem) => {
    if (!item) return
    const updated: QueueItem = { ...item, status: 'pending', error: null, updatedAt: Date.now() }
    await queue.setItem(item.id, updated)
    void refresh()
    triggerSync()
  }, [queue, refresh, triggerSync])

  const retryAllFailed = useCallback(async () => {
    if (!items) return
    const failed = items.filter((i) => i.status === 'error')
    for (const it of failed) {
      const updated: QueueItem = { ...it, status: 'pending', error: null, updatedAt: Date.now() }
      await queue.setItem(it.id, updated)
    }
    void refresh()
    triggerSync()
  }, [items, queue, refresh, triggerSync])

  const removeFailed = useCallback(async (item: QueueItem) => {
    if (item.status !== 'error') return
    const isCreate = item.type === 'CREATE_TRANSACTION'
    if (isCreate && item.ref?.localId) {
      const ok = window.confirm('Also remove the local draft transaction tied to this failed create?')
      if (ok) {
        try { await transactions.removeItem(item.ref.localId) } catch {}
      }
    }
    await queue.removeItem(item.id)
    void refresh()
  }, [queue, transactions, refresh])

  const previewReceipt = useCallback(async (item: QueueItem) => {
    if (item.type !== 'UPLOAD_RECEIPT') return
    const rqId = item?.payload?.receiptQueueId || item?.payload?.id
    if (!rqId) return
    try {
      const entry = await receipts.getItem<ReceiptBlobEntry>(rqId)
      if (!entry) return
      const url = URL.createObjectURL(entry.blob)
      setPreviewUrl(url)
    } catch {}
  }, [receipts])

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }, [previewUrl])

  const syncNow = useCallback(() => {
    triggerSync()
  }, [triggerSync])

  const pending = useMemo(() => (items || []).filter((i) => i.status === 'pending' || i.status === 'processing'), [items])
  const failed = useMemo(() => (items || []).filter((i) => i.status === 'error'), [items])
  const conflicts = useMemo(() => (items || []).filter((i) => i.status === 'conflict'), [items])
  const completed = useMemo(() =>
    (items || [])
      .filter((i) => i.status === 'done')
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 20)
  , [items])

  return (
    <main className="flex flex-col gap-4 md:gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Sync Queue</h1>
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
              meta.isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            )}>
              <span className={cn('h-2 w-2 rounded-full', meta.isOnline ? 'bg-emerald-500' : 'bg-red-500')} />
              {meta.isOnline ? 'Online' : 'Offline'}
            </span>
            <button onClick={syncNow} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm shadow-sm hover:opacity-90 active:scale-[0.98] transition">
              Sync now
            </button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">Last sync: {formatTime(meta.lastSyncAt)}</div>
        {!meta.isOnline && (
          <Alert className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/30">
            <AlertTitle>Offline mode</AlertTitle>
            <AlertDescription>
              You can queue changes while offline. They will sync automatically when you reconnect or when you tap Sync now.
            </AlertDescription>
          </Alert>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{(items?.length || 0)} total queue item(s)</div>
          <div className="flex items-center gap-2">
            <button onClick={retryAllFailed} disabled={!failed.length} className={cn('rounded-lg px-3 py-1.5 text-sm shadow-sm transition', failed.length ? 'bg-secondary text-secondary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed')}>Retry all failed</button>
            <Link href="/conflicts" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition">View conflicts</Link>
          </div>
        </div>
      </header>

      {/* Pending */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-medium">Pending</h2>
          <span className="text-sm text-muted-foreground">{pending.length}</span>
        </div>
        {items === null ? (
          <div className="grid gap-3">
            <div className="animate-pulse h-16 rounded-xl bg-muted" />
            <div className="animate-pulse h-16 rounded-xl bg-muted" />
          </div>
        ) : pending.length === 0 ? (
          <div className="text-sm text-muted-foreground">No pending items.</div>
        ) : (
          <div className="grid gap-3">
            {pending.map((item) => (
              <QueueCard key={item.id} item={item} onRetry={() => retryItem(item)} onRemove={() => {}} onPreview={() => previewReceipt(item)} />
            ))}
          </div>
        )}
      </section>

      {/* Failed */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-medium">Failed</h2>
          <span className="text-sm text-muted-foreground">{failed.length}</span>
        </div>
        {items === null ? (
          <div className="grid gap-3">
            <div className="animate-pulse h-16 rounded-xl bg-muted" />
          </div>
        ) : failed.length === 0 ? (
          <div className="text-sm text-muted-foreground">No failed items.</div>
        ) : (
          <div className="grid gap-3">
            {failed.map((item) => (
              <QueueCard key={item.id} item={item} onRetry={() => retryItem(item)} onRemove={() => removeFailed(item)} onPreview={() => previewReceipt(item)} />
            ))}
          </div>
        )}
      </section>

      {/* Conflicts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-medium">Conflicts</h2>
          <span className="text-sm text-muted-foreground">{conflicts.length}</span>
        </div>
        {items === null ? (
          <div className="grid gap-3">
            <div className="animate-pulse h-16 rounded-xl bg-muted" />
          </div>
        ) : conflicts.length === 0 ? (
          <div className="text-sm text-muted-foreground">No conflicts. Great job!</div>
        ) : (
          <div className="grid gap-3">
            {conflicts.map((item) => {
              const conflictId = item.ref?.remoteId || item.ref?.localId
              return (
                <div key={item.id} className="group rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs px-2 py-0.5">Conflict</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5">{entityLabel(item.type)}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">{actionLabel(item.type)}</span>
                      </div>
                      <div className="text-sm font-medium truncate">{conflictId ? `ID: ${truncateId(conflictId)}` : 'Unmapped item'}</div>
                      <div className="text-xs text-muted-foreground">Updated {formatTime(item.updatedAt)} • Created {formatTime(item.createdAt)}</div>
                      {item.error ? (
                        <div className="text-xs text-red-600 dark:text-red-400 line-clamp-2">{item.error}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                      {conflictId ? (
                        <Link href={`/conflicts/${conflictId}`} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm shadow-sm hover:opacity-90 active:scale-[0.98] transition text-center">Resolve</Link>
                      ) : (
                        <Link href="/conflicts" className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm shadow-sm hover:opacity-90 active:scale-[0.98] transition text-center">Resolve</Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Completed */}
      <section className="space-y-3 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-medium">Completed (last 20)</h2>
          <span className="text-sm text-muted-foreground">{completed.length}</span>
        </div>
        {items === null ? (
          <div className="grid gap-3">
            <div className="animate-pulse h-16 rounded-xl bg-muted" />
          </div>
        ) : completed.length === 0 ? (
          <div className="text-sm text-muted-foreground">No recent completed items.</div>
        ) : (
          <div className="grid gap-3">
            {completed.map((item) => (
              <QueueCard key={item.id} item={item} onRetry={() => {}} onRemove={() => {}} onPreview={() => previewReceipt(item)} />
            ))}
          </div>
        )}
      </section>

      {/* Image Preview Overlay */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closePreview}>
          <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="Receipt preview" className="w-full h-auto rounded-lg shadow-2xl" />
            <div className="mt-3 flex justify-end">
              <button onClick={closePreview} className="rounded-lg bg-secondary text-secondary-foreground px-4 py-2 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom sticky actions for mobile comfort */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', meta.isOnline ? 'bg-emerald-500' : 'bg-red-500')} />
            <span>{meta.isOnline ? 'Online' : 'Offline'}</span>
            <span>•</span>
            <span>Pending {pending.length}</span>
            <span>•</span>
            <span>Failed {failed.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={retryAllFailed} disabled={!failed.length} className={cn('rounded-lg px-3 py-1.5 text-sm shadow-sm transition', failed.length ? 'bg-secondary text-secondary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed')}>Retry failed</button>
            <button onClick={syncNow} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm shadow-sm hover:opacity-90">Sync</button>
          </div>
        </div>
      </div>
    </main>
  )
}

function QueueCard({ item, onRetry, onRemove, onPreview }: { item: QueueItem; onRetry: () => void; onRemove: () => void; onPreview: () => void }) {
  const isReceipt = item.type === 'UPLOAD_RECEIPT'
  const isProcessing = item.status === 'processing'
  const showRetry = item.status === 'error' || item.status === 'pending'
  const showRemove = item.status === 'error'

  return (
    <div className="group rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full text-xs px-2 py-0.5',
              item.status === 'pending' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
              item.status === 'processing' && 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
              item.status === 'error' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
              item.status === 'conflict' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
              item.status === 'done' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
            )}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5">{entityLabel(item.type)}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">{actionLabel(item.type)}</span>
          </div>
          <div className="text-sm font-medium truncate">ID: {truncateId(item.ref?.remoteId || item.ref?.localId)}</div>
          <div className="text-xs text-muted-foreground">Updated {formatTime(item.updatedAt)} • Created {formatTime(item.createdAt)}</div>
          {item.error ? (
            <div className="text-xs text-red-600 dark:text-red-400 line-clamp-2">{item.error}</div>
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          {isReceipt && (
            <button onClick={onPreview} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition">Preview</button>
          )}
          {showRetry && (
            <button onClick={onRetry} disabled={isProcessing} className={cn('rounded-lg px-3 py-1.5 text-sm shadow-sm transition', isProcessing ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-secondary text-secondary-foreground hover:opacity-90')}>Retry</button>
          )}
          {showRemove && (
            <button onClick={onRemove} className="rounded-lg bg-destructive text-destructive-foreground px-3 py-1.5 text-sm shadow-sm hover:opacity-90">Remove</button>
          )}
        </div>
      </div>
    </div>
  )
}
