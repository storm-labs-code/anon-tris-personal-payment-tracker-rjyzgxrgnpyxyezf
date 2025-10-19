'use client'

/**
 * CODE INSIGHT
 * This client component loads conflict items from IndexedDB (localForage), displays them in a list
 * with KRW formatting, and provides bulk resolution actions (keep mine / keep server). It also links
 * each row to the conflict detail page for manual resolution.
 * Designed for mobile-first interaction with clear feedback and confirmations.
 */

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import localforage from 'localforage'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

// Local store instances
const conflictsStore = localforage.createInstance({ name: 'tris', storeName: 'conflicts' })
const queueStore = localforage.createInstance({ name: 'tris', storeName: 'syncQueue' })
const transactionsStore = localforage.createInstance({ name: 'tris', storeName: 'transactions' })

// Types for our local stores
export type QueueItemType = 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'DELETE_TRANSACTION' | 'UPLOAD_RECEIPT'
export type QueueItemStatus = 'pending' | 'processing' | 'error' | 'conflict' | 'done'

export interface QueueItem {
  id: string
  type: QueueItemType
  ref: { localId?: string; remoteId?: string }
  payload?: any
  baseVersion?: number | null
  status: QueueItemStatus
  error?: string | null
}

export interface ConflictItem {
  id: string // transaction id (remoteId or localId)
  myChanges: any
  serverVersion: any
  decided?: 'mine' | 'server' | 'merge'
}

function useCurrencyKRW() {
  return useMemo(
    () => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }),
    []
  )
}

function formatDateTime(dt?: string | number | Date) {
  if (!dt) return '-'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

async function listConflicts(): Promise<ConflictItem[]> {
  const items: ConflictItem[] = []
  await conflictsStore.iterate<ConflictItem, void>((value) => {
    if (value) items.push(value)
  })
  // Sort by newest server updated_at desc if available
  items.sort((a, b) => {
    const av = a?.serverVersion?.updated_at ? new Date(a.serverVersion.updated_at).getTime() : 0
    const bv = b?.serverVersion?.updated_at ? new Date(b.serverVersion.updated_at).getTime() : 0
    return bv - av
  })
  return items
}

async function findQueueKeysForTransaction(transactionId: string): Promise<string[]> {
  const keys: string[] = []
  await queueStore.iterate<QueueItem, void>((value, key) => {
    if (!value) return
    const { ref } = value
    if (!ref) return
    if (ref.remoteId === transactionId || ref.localId === transactionId) {
      keys.push(key)
    }
  })
  return keys
}

export default function ConflictListClient() {
  const [conflicts, setConflicts] = useState<ConflictItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'info' | 'error'; title: string; message?: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const krw = useCurrencyKRW()

  const refresh = useCallback(async () => {
    const data = await listConflicts()
    setConflicts(data)
  }, [])

  useEffect(() => {
    refresh()
    // Listen to storage events via polling-lite to keep UI fresh; avoids BroadcastChannel complexity now
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh])

  const handleKeepMineAll = useCallback(async () => {
    if (!conflicts || conflicts.length === 0) return
    const ok = window.confirm('Resolve all conflicts by keeping your changes? This will re-queue your edits for sync.')
    if (!ok) return
    setBusy(true)
    try {
      let affected = 0
      for (const c of conflicts) {
        // Mark decision
        const decidedItem: ConflictItem = { ...c, decided: 'mine' }
        await conflictsStore.setItem(c.id, decidedItem)
        // Re-queue any conflict queue item for this transaction
        const keys = await findQueueKeysForTransaction(c.id)
        for (const k of keys) {
          const item = await queueStore.getItem<QueueItem>(k)
          if (!item) continue
          if (item.status === 'conflict' || item.status === 'error') {
            item.status = 'pending'
            item.error = null
            await queueStore.setItem(k, item)
            affected++
          }
        }
      }
      setBanner({ type: 'success', title: 'Bulk action queued', message: `${affected} change(s) set to sync with your version.` })
    } catch (e: any) {
      setBanner({ type: 'error', title: 'Failed to queue bulk resolution', message: e?.message || 'Unknown error' })
    } finally {
      setBusy(false)
      startTransition(() => router.refresh())
      refresh()
    }
  }, [conflicts, refresh, router])

  const handleKeepServerAll = useCallback(async () => {
    if (!conflicts || conflicts.length === 0) return
    const ok = window.confirm('Resolve all by keeping the server version? This discards your local edits for these items.')
    if (!ok) return
    setBusy(true)
    try {
      let cleared = 0
      for (const c of conflicts) {
        // Update local transaction to server version and clear pending/conflict flags if present
        const txn = c.serverVersion ? { ...c.serverVersion } : null
        if (txn) {
          // Normalize flags used by local cache
          (txn as any).pending = false
          ;(txn as any).conflict = false
          await transactionsStore.setItem(c.id, txn)
        }
        // Remove related queue items for this transaction that were in conflict
        const keys = await findQueueKeysForTransaction(c.id)
        for (const k of keys) {
          const item = await queueStore.getItem<QueueItem>(k)
          if (!item) continue
          if (item.status === 'conflict' || item.status === 'error') {
            // Discard this queued change entirely since we keep server
            await queueStore.removeItem(k)
          }
        }
        // Remove conflict entry
        await conflictsStore.removeItem(c.id)
        cleared++
      }
      setBanner({ type: 'success', title: 'Conflicts cleared', message: `${cleared} conflict(s) resolved by keeping server.` })
    } catch (e: any) {
      setBanner({ type: 'error', title: 'Failed to resolve conflicts', message: e?.message || 'Unknown error' })
    } finally {
      setBusy(false)
      startTransition(() => router.refresh())
      refresh()
    }
  }, [conflicts, refresh, router])

  const EmptyState = (
    <div className="rounded-xl border border-dashed border-input p-8 text-center">
      <div className="text-lg font-medium mb-1">No conflicts</div>
      <p className="text-sm text-muted-foreground mb-4">You’re all caught up. Pending items will appear here if any edits conflict with server changes.</p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/queue" className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:opacity-90">
          View Sync Queue
        </Link>
        <Link href="/" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Go Home
        </Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 md:space-y-6">
      {banner && (
        <Alert className={banner.type === 'error' ? 'border-destructive/50 text-destructive' : banner.type === 'success' ? 'border-green-600/40 text-green-700 dark:text-green-400' : ''}>
          <AlertTitle>{banner.title}</AlertTitle>
          {banner.message ? <AlertDescription>{banner.message}</AlertDescription> : null}
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Total conflicts</div>
          <div className="text-xl font-semibold">{conflicts ? conflicts.length : <span className="inline-flex"><Skeleton className="h-6 w-10" /></span>}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleKeepMineAll}
            disabled={busy || !conflicts || conflicts.length === 0}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Resolve all by keeping my changes"
          >
            {busy ? 'Working…' : 'Resolve all · Keep mine'}
          </button>
          <button
            onClick={handleKeepServerAll}
            disabled={busy || !conflicts || conflicts.length === 0}
            className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Resolve all by keeping server version"
          >
            {busy ? 'Working…' : 'Resolve all · Keep server'}
          </button>
        </div>
      </div>

      <Separator />

      {/* List */}
      <div className="grid grid-cols-1 gap-3 md:gap-4">
        {conflicts === null && (
          <>
            <div className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-5 w-40 mb-3" />
              <Skeleton className="h-4 w-64 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-5 w-48 mb-3" />
              <Skeleton className="h-4 w-60 mb-2" />
              <Skeleton className="h-4 w-28" />
            </div>
          </>
        )}
        {conflicts && conflicts.length === 0 && EmptyState}
        {conflicts && conflicts.length > 0 && conflicts.map((c) => {
          const server = c.serverVersion || {}
          const mine = c.myChanges || {}
          const amount = (mine.amount ?? server.amount) ?? 0
          const occurredAt = mine.occurred_at ?? mine.date ?? server.occurred_at ?? server.date
          const payee = mine.payee ?? server.payee ?? '—'
          return (
            <div key={c.id} className="group rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base md:text-lg font-semibold leading-tight">{payee}</h3>
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Conflict</span>
                    {c.decided && (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">{c.decided}</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatDateTime(occurredAt)} · <span className="font-medium text-foreground">{krw.format(Number(amount || 0))}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/conflicts/${encodeURIComponent(c.id)}`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    aria-label={`Resolve conflict for ${payee}`}
                  >
                    Resolve
                  </Link>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div>
                  Server updated: <span className="text-foreground">{formatDateTime(server.updated_at)}</span>
                </div>
                {server.category && (
                  <div className="hidden sm:block">Category: <span className="text-foreground">{server.category}</span></div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
