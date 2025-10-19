'use client'

/**
 * CODE INSIGHT
 * This code's use case is to load a specific conflict by id from IndexedDB, compare local (mine) vs server versions,
 * and allow the user to resolve via Keep Mine, Keep Server, or Merge per-field choices. It updates local stores and
 * re-enqueues sync operations to be processed by the global SyncProvider.
 * This code's ui feel is modern, minimal, focused and mobile-first with clear highlighting of differences.
 */

import React, { useEffect, useMemo, useState } from 'react'
import localforage from 'localforage'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client-browser'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// LocalForage store instances
const conflictsDB = localforage.createInstance({ name: 'tris', storeName: 'conflicts' })
const transactionsDB = localforage.createInstance({ name: 'tris', storeName: 'transactions' })
const queueDB = localforage.createInstance({ name: 'tris', storeName: 'syncQueue' })
const syncMetaDB = localforage.createInstance({ name: 'tris', storeName: 'syncMeta' })

// Types
type TransactionPayload = {
  amount?: number | string
  occurred_at?: string
  category_id?: string | null
  payee?: string | null
  payment_method?: string
  notes?: string | null
}

interface ConflictItem {
  id: string // remote id or local id (but this page should be remote id)
  myChanges: {
    payload: TransactionPayload
    baseVersion?: number | null
  }
  serverVersion: {
    payload: Required<TransactionPayload>
    version?: number | null
    updated_at?: string
  }
  decided?: 'mine' | 'server' | 'merge'
}

interface QueueItem {
  id: string
  type: 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'DELETE_TRANSACTION' | 'UPLOAD_RECEIPT'
  ref: { localId?: string; remoteId?: string }
  payload?: any
  baseVersion?: number | null
  status: 'pending' | 'processing' | 'error' | 'conflict' | 'done'
  error?: string | null
  createdAt?: number
  unconditional?: boolean // when true, update should overwrite without version guard
}

// Utils
const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine

const formatKRW = (v: any) => {
  if (v === null || v === undefined || v === '') return ''
  const num = typeof v === 'string' ? Number(v) : Number(v)
  if (Number.isNaN(num)) return String(v)
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(num)
}

const formatDateTime = (v?: string) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.valueOf())) return v
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(d)
}

const fieldLabels: Record<keyof Required<TransactionPayload>, string> = {
  amount: 'Amount',
  occurred_at: 'Date',
  category_id: 'Category',
  payee: 'Payee',
  payment_method: 'Method',
  notes: 'Notes',
}

const pickFields: (keyof Required<TransactionPayload>)[] = [
  'amount',
  'occurred_at',
  'category_id',
  'payee',
  'payment_method',
  'notes',
]

function valueDisplay(field: keyof Required<TransactionPayload>, v: any) {
  if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>
  if (field === 'amount') return <span>{formatKRW(v)}</span>
  if (field === 'occurred_at') return <span>{formatDateTime(String(v))}</span>
  return <span>{String(v)}</span>
}

function shallowEqual(a: any, b: any) {
  return a === b
}

function useServerTransaction(remoteId: string | null) {
  const [server, setServer] = useState<Required<TransactionPayload> & { updated_at?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const fetchServer = async () => {
      if (!remoteId || !isOnline()) {
        setError(!isOnline() ? 'Offline: showing last known server data' : null)
        return
      }
      setLoading(true)
      setError(null)
      const { data, error } = await supabaseBrowser
        .from('transactions')
        .select('id, amount, occurred_at, category_id, payee, payment_method, notes, updated_at')
        .eq('id', remoteId)
        .maybeSingle()
      if (!active) return
      if (error) {
        setError(error.message || 'Failed to fetch from server')
      } else if (data) {
        setServer({
          amount: data.amount as unknown as number,
          occurred_at: data.occurred_at as string,
          category_id: (data.category_id ?? null) as string | null,
          payee: (data.payee ?? null) as string | null,
          payment_method: data.payment_method as string,
          notes: (data.notes ?? null) as string | null,
          updated_at: data.updated_at as string,
        })
      }
      setLoading(false)
    }
    fetchServer()
    return () => {
      active = false
    }
  }, [remoteId])

  return { server, loading, error }
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}

export default function Client({ conflictId }: { conflictId: string }) {
  const router = useRouter()

  const [conflict, setConflict] = useState<ConflictItem | null>(null)
  const [conflictLoading, setConflictLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [localTx, setLocalTx] = useState<Required<TransactionPayload> | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [selection, setSelection] = useState<Record<keyof Required<TransactionPayload>, 'mine' | 'server'>>({
    amount: 'mine',
    occurred_at: 'mine',
    category_id: 'mine',
    payee: 'mine',
    payment_method: 'mine',
    notes: 'mine',
  })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Load conflict and local transaction snapshot
  useEffect(() => {
    let active = true
    ;(async () => {
      setConflictLoading(true)
      setLoadError(null)
      try {
        const c = (await conflictsDB.getItem(conflictId)) as ConflictItem | null
        if (!active) return
        if (!c) {
          setLoadError('Conflict not found or already resolved.')
          setConflictLoading(false)
          return
        }
        setConflict(c)
        // Load the local transaction snapshot for 'mine' view
        const local = (await transactionsDB.getItem(c.id)) as any
        if (local) {
          const mine: Required<TransactionPayload> = {
            amount: (local.amount ?? null) as any,
            occurred_at: (local.occurred_at ?? local.date ?? null) as any, // allow legacy 'date' field if exists
            category_id: (local.category_id ?? null) as any,
            payee: (local.payee ?? null) as any,
            payment_method: (local.payment_method ?? null) as any,
            notes: (local.notes ?? null) as any,
          }
          setLocalTx(mine)
        } else {
          // Fallback: approximate mine by applying myChanges on top of serverVersion payload
          const approxMine: Required<TransactionPayload> = {
            amount: (c.myChanges.payload.amount ?? c.serverVersion.payload.amount ?? null) as any,
            occurred_at: (c.myChanges.payload.occurred_at ?? c.serverVersion.payload.occurred_at ?? null) as any,
            category_id: (c.myChanges.payload.category_id ?? c.serverVersion.payload.category_id ?? null) as any,
            payee: (c.myChanges.payload.payee ?? c.serverVersion.payload.payee ?? null) as any,
            payment_method: (c.myChanges.payload.payment_method ?? c.serverVersion.payload.payment_method ?? null) as any,
            notes: (c.myChanges.payload.notes ?? c.serverVersion.payload.notes ?? null) as any,
          }
          setLocalTx(approxMine)
        }
        // Seed merge selections: default to mine if I changed it, else server
        const defaultSel: any = {}
        for (const f of pickFields) {
          defaultSel[f] = c.myChanges.payload.hasOwnProperty(f) ? 'mine' : 'server'
        }
        setSelection((prev) => ({ ...prev, ...defaultSel }))
      } catch (e: any) {
        if (!active) return
        setLoadError(e?.message || 'Failed to load conflict')
      } finally {
        if (active) setConflictLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [conflictId])

  const remoteId = useMemo(() => conflict?.id ?? null, [conflict])
  const { server, loading: serverLoading, error: serverError } = useServerTransaction(remoteId)

  const differences = useMemo(() => {
    const diffs: Record<string, boolean> = {}
    if (!localTx && !server) return diffs
    for (const f of pickFields) {
      const mineV = (localTx as any)?.[f]
      const serverV = (server as any)?.[f]
      diffs[f] = !shallowEqual(mineV ?? null, serverV ?? null)
    }
    return diffs
  }, [localTx, server])

  const mergedPayload = useMemo(() => {
    const payload: TransactionPayload = {}
    if (!localTx && !server) return payload
    for (const f of pickFields) {
      const choice = selection[f]
      const mineV = (localTx as any)?.[f]
      const serverV = (server as any)?.[f] ?? (conflict?.serverVersion.payload as any)?.[f]
      ;(payload as any)[f] = choice === 'mine' ? mineV ?? null : serverV ?? null
    }
    return payload
  }, [selection, localTx, server, conflict])

  const triggerSync = async () => {
    try {
      await syncMetaDB.setItem('lastSyncRequestedAt', Date.now())
    } catch {}
    try {
      const bc = new BroadcastChannel('tris-sync')
      bc.postMessage({ type: 'PROCESS_QUEUE' })
      setTimeout(() => bc.close(), 500)
    } catch {}
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        // @ts-ignore
        if (reg.sync && reg.sync.register) {
          // @ts-ignore
          await reg.sync.register('sync-queue')
        }
      }
    } catch {}
  }

  const removeConflictEntry = async (id: string) => {
    await conflictsDB.removeItem(id)
  }

  const removeRelatedUpdateQueueItems = async (id: string) => {
    // Scan all queue items; remove UPDATE_TRANSACTION with this id in ref
    const keys = await queueDB.keys()
    await Promise.all(
      keys.map(async (k) => {
        const item = (await queueDB.getItem(k)) as QueueItem | null
        if (item && item.type === 'UPDATE_TRANSACTION' && (item.ref.remoteId === id || item.ref.localId === id)) {
          await queueDB.removeItem(k)
        }
      })
    )
  }

  const enqueueUpdate = async (id: string, payload: TransactionPayload, baseVersion: number | null | undefined, unconditional = false) => {
    const queueItem: QueueItem = {
      id: `q_${id}_${Date.now()}`,
      type: 'UPDATE_TRANSACTION',
      ref: { remoteId: id },
      payload,
      baseVersion: baseVersion ?? null,
      status: 'pending',
      createdAt: Date.now(),
      unconditional,
    }
    await queueDB.setItem(queueItem.id, queueItem)
  }

  const updateLocalTransaction = async (id: string, payload: TransactionPayload, options?: { pending?: boolean; conflict?: boolean }) => {
    const current = ((await transactionsDB.getItem(id)) as any) || { id }
    const next = {
      ...current,
      ...payload,
      pending: options?.pending ?? current.pending ?? false,
      conflict: options?.conflict ?? false,
      updated_at: new Date().toISOString(),
    }
    await transactionsDB.setItem(id, next)
  }

  const handleKeepMine = async () => {
    if (!conflict || !remoteId || !localTx) return
    setBusy(true)
    setActionError(null)
    try {
      // Enqueue an unconditional update using my local snapshot
      const payload: TransactionPayload = { ...localTx }
      await enqueueUpdate(remoteId, payload, conflict.myChanges.baseVersion ?? null, true)
      // Mark local as pending true and clear conflict
      await updateLocalTransaction(remoteId, payload, { pending: true, conflict: false })
      await removeConflictEntry(conflict.id)
      await triggerSync()
      router.replace('/queue')
    } catch (e: any) {
      setActionError(e?.message || 'Failed to keep mine')
    } finally {
      setBusy(false)
    }
  }

  const handleKeepServer = async () => {
    if (!conflict || !remoteId) return
    setBusy(true)
    setActionError(null)
    try {
      // Apply server payload locally, clear pending & conflict
      const serverPayload: TransactionPayload = { ...conflict.serverVersion.payload }
      await updateLocalTransaction(remoteId, serverPayload, { pending: false, conflict: false })
      // Remove conflicting update queue items
      await removeRelatedUpdateQueueItems(remoteId)
      await removeConflictEntry(conflict.id)
      await triggerSync()
      router.replace('/queue')
    } catch (e: any) {
      setActionError(e?.message || 'Failed to keep server')
    } finally {
      setBusy(false)
    }
  }

  const handleMergeAndSave = async () => {
    if (!conflict || !remoteId) return
    setBusy(true)
    setActionError(null)
    try {
      const payload = { ...mergedPayload }
      // Update local transaction and enqueue guarded update (baseVersion unknown here; let processor decide)
      await updateLocalTransaction(remoteId, payload, { pending: true, conflict: false })
      await enqueueUpdate(remoteId, payload, null, false)
      await removeConflictEntry(conflict.id)
      await triggerSync()
      router.replace('/queue')
    } catch (e: any) {
      setActionError(e?.message || 'Failed to save merged changes')
    } finally {
      setBusy(false)
    }
  }

  const loading = conflictLoading || !conflict

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.push('/queue')}
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          ← Back to Queue
        </button>
        <div className="text-right">
          <h1 className="text-lg font-semibold">Resolve Conflict</h1>
          {conflict?.serverVersion?.updated_at ? (
            <p className="text-xs text-muted-foreground">Server updated {formatDateTime(conflict.serverVersion.updated_at)}</p>
          ) : null}
        </div>
      </div>

      {serverError ? (
        <Alert className="border-destructive/50">
          <AlertTitle>Server fetch issue</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      {!isOnline() ? (
        <Alert className="border-yellow-400/50">
          <AlertTitle>Offline</AlertTitle>
          <AlertDescription>Working offline. You can still resolve and your choice will sync when online.</AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert className="border-destructive/50">
          <AlertTitle>Conflict not found</AlertTitle>
          <AlertDescription>
            {loadError} <button className="underline underline-offset-2" onClick={() => router.push('/conflicts')}>Go to Conflicts</button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <SectionHeader title="My changes" />
            <div className="space-y-3">
              {pickFields.map((f) => (
                <div key={f} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{fieldLabels[f]}</div>
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <SectionHeader title="Server version" />
            <div className="space-y-3">
              {pickFields.map((f) => (
                <div key={f} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{fieldLabels[f]}</div>
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : conflict && localTx ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <SectionHeader title="My changes" subtitle="Your local version" />
              <div className="space-y-3">
                {pickFields.map((f) => (
                  <div key={f} className={
                    'rounded-md p-3 transition-colors ' + (differences[f] ? 'bg-accent/40' : 'bg-muted/30')
                  }>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground">{fieldLabels[f]}</span>
                      {differences[f] ? (
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Different</span>
                      ) : null}
                    </div>
                    <div className="text-sm">{valueDisplay(f, (localTx as any)[f])}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <SectionHeader title="Server version" subtitle="Current on server" />
              <div className="space-y-3">
                {pickFields.map((f) => (
                  <div key={f} className={
                    'rounded-md p-3 transition-colors ' + (differences[f] ? 'bg-accent/40' : 'bg-muted/30')
                  }>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground">{fieldLabels[f]}</span>
                    </div>
                    <div className="text-sm">{valueDisplay(f, (server as any)?.[f] ?? (conflict.serverVersion.payload as any)[f])}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => setMergeOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
            >
              <span>Merge fields</span>
              <span className="text-xs text-muted-foreground">{mergeOpen ? 'Hide' : 'Show'} options</span>
            </button>
            {mergeOpen ? (
              <>
                <Separator />
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  {pickFields.map((f) => (
                    <div key={f} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-medium text-muted-foreground">{fieldLabels[f]}</div>
                        {differences[f] ? (
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Different</span>
                        ) : (
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Same</span>
                        )}
                      </div>
                      <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="mb-1 text-[11px] text-muted-foreground">Mine</div>
                          <div className="rounded-md bg-muted/40 p-2 text-sm">{valueDisplay(f, (localTx as any)[f])}</div>
                        </div>
                        <div>
                          <div className="mb-1 text-[11px] text-muted-foreground">Server</div>
                          <div className="rounded-md bg-muted/40 p-2 text-sm">{valueDisplay(f, (server as any)?.[f] ?? (conflict.serverVersion.payload as any)[f])}</div>
                        </div>
                      </div>
                      <div className="inline-flex overflow-hidden rounded-md border">
                        <button
                          type="button"
                          onClick={() => setSelection((s) => ({ ...s, [f]: 'mine' }))}
                          className={'px-3 py-1.5 text-sm ' + (selection[f] === 'mine' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                        >
                          Use mine
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelection((s) => ({ ...s, [f]: 'server' }))}
                          className={'px-3 py-1.5 text-sm border-l ' + (selection[f] === 'server' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                        >
                          Use server
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2 p-4 pt-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleMergeAndSave}
                    className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Save merged
                  </button>
                </div>
              </>
            ) : null}
          </div>

          {actionError ? (
            <Alert className="border-destructive/50">
              <AlertTitle>Action failed</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="sticky bottom-4 z-10 mx-auto w-full max-w-4xl">
            <div className="rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/70">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleKeepServer}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Keep server
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMergeOpen(true)}
                  className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Merge fields
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleKeepMine}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Keep mine
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {!loading && !localTx && (
        <Alert>
          <AlertTitle>Local version unavailable</AlertTitle>
          <AlertDescription>We could not load your local version. You can still keep the server version to proceed.</AlertDescription>
        </Alert>
      )}

      {serverLoading && (
        <div className="text-center text-xs text-muted-foreground">Refreshing server data…</div>
      )}
    </div>
  )
}
