'use client'

/**
 * CODE INSIGHT
 * This code's use case is a client-side edit form that loads a transaction by id (local or remote) from IndexedDB, allows editing, and queues sync actions.
 * This code's full epic context is the offline-first Transaction CRUD flow with localForage stores: transactions, syncQueue, receipts, and conflict handling.
 * This code's ui feel is calm and confident, with clear field grouping, inline validation, subtle animations, and mobile-first ergonomics.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import localforage from 'localforage'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client-browser'
import { cn } from '@/utils/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// LocalForage instances
const txStore = localforage.createInstance({ name: 'tris', storeName: 'transactions' })
const queueStore = localforage.createInstance({ name: 'tris', storeName: 'syncQueue' })
const receiptsStore = localforage.createInstance({ name: 'tris', storeName: 'receipts' })

// Types
interface LocalTransaction {
  id: string // can be local-uuid or remote uuid
  remoteId?: string | null
  amount: number
  occurred_at: string // ISO string
  category_id?: string | null
  payee?: string | null
  payment_method: string
  notes?: string | null
  pending?: boolean
  deleted?: boolean
  conflict?: boolean
  baseVersion?: number | null // a timestamp or server version number if known
  lastSyncedAt?: string | null
  receipt_url?: string | null
  receiptPending?: boolean
  // Any extra keys are tolerated
  [key: string]: any
}

type QueueItemType =
  | 'CREATE_TRANSACTION'
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'UPLOAD_RECEIPT'

type QueueStatus = 'pending' | 'processing' | 'error' | 'conflict' | 'done'

interface QueueItem<T = any> {
  id: string
  type: QueueItemType
  ref: { localId?: string; remoteId?: string | null }
  payload?: T
  baseVersion?: number | null
  status: QueueStatus
  error?: string | null
  createdAt: string
  updatedAt?: string
}

interface Category {
  id: string
  name: string
}

function isoToLocalInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  // Format to yyyy-MM-ddTHH:mm for datetime-local
  const pad = (n: number) => `${n}`.padStart(2, '0')
  const yyyy = d.getFullYear()
  const MM = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`
}

function localInputToIso(localValue: string) {
  if (!localValue) return ''
  // datetime-local returns local time; convert to ISO
  const d = new Date(localValue)
  return d.toISOString()
}

function formatKRW(n: number) {
  try {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(
      isFinite(n) ? n : 0
    )
  } catch {
    return `${Math.round(n).toLocaleString('ko-KR')}원`
  }
}

function isLocalId(id: string) {
  return id.startsWith('local-')
}

function generateId(prefix?: string) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return prefix ? `${prefix}${id}` : id
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'card', label: '카드' },
  { value: 'cash', label: '현금' },
  { value: 'bank_transfer', label: '계좌이체' },
  { value: 'mobile', label: '모바일' },
  { value: 'other', label: '기타' },
]

function computeDiff<T extends Record<string, any>>(base: T, next: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {}
  for (const k of keys) {
    const a = base[k]
    const b = next[k]
    // Compare with loose check for undefined/null differences
    const changed = (a ?? null) !== (b ?? null)
    if (changed) out[k] = b
  }
  return out
}

function useOnline() {
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function Toast({ message, type }: { message: string; type?: 'success' | 'error' | 'info' }) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto w-fit rounded-full px-4 py-2 text-sm shadow-lg backdrop-blur',
        type === 'success' && 'bg-emerald-600/90 text-white',
        type === 'error' && 'bg-red-600/90 text-white',
        (!type || type === 'info') && 'bg-primary text-primary-foreground'
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}

export default function Client({ id }: { id: string }) {
  const router = useRouter()
  const online = useOnline()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null)

  const [categories, setCategories] = useState<Category[]>([])

  const [tx, setTx] = useState<LocalTransaction | null>(null)
  const [form, setForm] = useState({
    amount: '',
    occurred_at: '',
    category_id: '' as string | null,
    payee: '' as string,
    payment_method: 'card',
    notes: '' as string,
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const initialRef = useRef<typeof form | null>(null)

  // Load transaction (from local cache) and categories (remote if possible)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Find by direct id
        let item = (await txStore.getItem<LocalTransaction>(id)) || null
        // If not found and id looks remote, search by remoteId
        if (!item) {
          await txStore.iterate<LocalTransaction, void>((value) => {
            if (value && value.remoteId === id) {
              item = value
              return {}
            }
          })
        }

        if (!item) {
          setError('거래를 찾을 수 없어요. 오프라인이거나 데이터가 손실되었을 수 있어요.')
          setLoading(false)
          return
        }

        if (cancelled) return

        setTx(item)
        const f = {
          amount: item.amount?.toString() ?? '',
          occurred_at: isoToLocalInput(item.occurred_at),
          category_id: item.category_id ?? '',
          payee: item.payee ?? '',
          payment_method: item.payment_method ?? 'card',
          notes: item.notes ?? '',
        }
        setForm(f)
        initialRef.current = f
      } catch (e: any) {
        console.error(e)
        setError('편집 데이터를 불러오는 중 문제가 발생했어요.')
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let mounted = true
    async function fetchCategories() {
      try {
        const { data, error } = await supabaseBrowser
          .from('categories')
          .select('id,name')
          .order('name', { ascending: true })
        if (!mounted) return
        if (error) {
          // If error (offline), ignore silently
          return
        }
        setCategories(data || [])
      } catch {
        // ignore
      }
    }
    fetchCategories()
    return () => {
      mounted = false
    }
  }, [])

  const hasChanges = useMemo(() => {
    if (!initialRef.current) return false
    const i = initialRef.current
    return (
      i.amount !== form.amount ||
      i.occurred_at !== form.occurred_at ||
      (i.category_id ?? '') !== (form.category_id ?? '') ||
      i.payee !== form.payee ||
      i.payment_method !== form.payment_method ||
      i.notes !== form.notes ||
      !!receiptFile
    )
  }, [form, receiptFile])

  const amountNumber = useMemo(() => {
    const n = Number(form.amount.replace(/[^\d.-]/g, ''))
    return isFinite(n) ? Math.max(0, Math.round(n)) : 0
  }, [form.amount])

  const setField = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [key]: value }))
  }, [])

  const validate = useCallback(() => {
    const errs: string[] = []
    if (!amountNumber || amountNumber <= 0) errs.push('금액을 입력하세요 (0원보다 커야 해요).')
    if (!form.occurred_at) errs.push('날짜와 시간을 선택하세요.')
    if (!form.payment_method) errs.push('결제 수단을 선택하세요.')
    return errs
  }, [amountNumber, form.occurred_at, form.payment_method])

  const showToast = useCallback((message: string, type?: 'success' | 'error' | 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2200)
  }, [])

  const onSubmit = useCallback(async () => {
    if (!tx) return
    const errs = validate()
    if (errs.length) {
      showToast(errs[0], 'error')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const next: LocalTransaction = {
        ...tx,
        amount: amountNumber,
        occurred_at: localInputToIso(form.occurred_at),
        category_id: form.category_id || null,
        payee: form.payee || null,
        payment_method: form.payment_method,
        notes: form.notes || null,
        pending: true,
        updatedAt: new Date().toISOString(),
      }

      // Compute diff payload for queue
      const keys: (keyof LocalTransaction)[] = [
        'amount',
        'occurred_at',
        'category_id',
        'payee',
        'payment_method',
        'notes',
      ]
      const baseForDiff = {
        amount: tx.amount,
        occurred_at: tx.occurred_at,
        category_id: tx.category_id ?? null,
        payee: tx.payee ?? null,
        payment_method: tx.payment_method,
        notes: tx.notes ?? null,
      } as any
      const nextForDiff = {
        amount: next.amount,
        occurred_at: next.occurred_at,
        category_id: next.category_id ?? null,
        payee: next.payee ?? null,
        payment_method: next.payment_method,
        notes: next.notes ?? null,
      } as any
      const payload = computeDiff(baseForDiff, nextForDiff, keys as any)

      // Persist transaction locally (optimistic)
      await txStore.setItem<LocalTransaction>(tx.id, next)

      // Enqueue update if there are changes
      if (Object.keys(payload).length > 0) {
        const q: QueueItem<typeof payload> = {
          id: generateId('q-'),
          type: 'UPDATE_TRANSACTION',
          ref: {
            localId: isLocalId(tx.id) ? tx.id : undefined,
            remoteId: !isLocalId(tx.id) ? (tx.remoteId || tx.id) : tx.remoteId || null,
          },
          payload,
          baseVersion: typeof tx.baseVersion === 'number' ? tx.baseVersion : null,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }
        await queueStore.setItem(q.id, q)
      }

      // Handle receipt attachment if any
      if (receiptFile) {
        const receiptQueueId = generateId('rq-')
        const meta = {
          mime: receiptFile.type,
          size: receiptFile.size,
          name: receiptFile.name,
          createdAt: new Date().toISOString(),
          transactionRef: { localId: isLocalId(tx.id) ? tx.id : undefined, remoteId: tx.remoteId || (!isLocalId(tx.id) ? tx.id : undefined) },
        }
        await receiptsStore.setItem(receiptQueueId, { blob: receiptFile, metadata: meta })
        const q: QueueItem<{ receiptQueueId: string }> = {
          id: generateId('q-'),
          type: 'UPLOAD_RECEIPT',
          ref: {
            localId: isLocalId(tx.id) ? tx.id : undefined,
            remoteId: !isLocalId(tx.id) ? (tx.remoteId || tx.id) : tx.remoteId || null,
          },
          payload: { receiptQueueId },
          baseVersion: typeof tx.baseVersion === 'number' ? tx.baseVersion : null,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }
        await queueStore.setItem(q.id, q)

        // mark local tx receiptPending
        await txStore.setItem<LocalTransaction>(tx.id, { ...next, receiptPending: true })
      }

      showToast('변경 사항이 동기화 대기열에 추가됐어요.', 'success')
      // Navigate back to detail page using the same id in URL (supports localId)
      router.push(`/transactions/${id}`)
    } catch (e: any) {
      console.error(e)
      setError('저장 중 오류가 발생했어요. 다시 시도해 주세요.')
      showToast('저장 중 오류가 발생했어요.', 'error')
    } finally {
      setSaving(false)
    }
  }, [tx, validate, amountNumber, form, receiptFile, router, id, showToast])

  const onDiscard = useCallback(async () => {
    if (!tx) return
    const confirmed = window.confirm('로컬 변경 사항을 폐기할까요? 서버에 저장된 버전으로 되돌립니다.')
    if (!confirmed) return

    setSaving(true)
    setError(null)

    try {
      let restored: LocalTransaction | null = null
      // If we have a remote id and are online, fetch server row for authoritative restore
      const remoteId = !isLocalId(tx.id) ? tx.id : tx.remoteId
      if (remoteId && online) {
        const { data, error } = await supabaseBrowser
          .from('transactions')
          .select('id, amount, occurred_at, category_id, payee, payment_method, notes, updated_at')
          .eq('id', remoteId)
          .maybeSingle()
        if (!error && data) {
          restored = {
            ...tx,
            remoteId: remoteId,
            id: tx.id, // keep local key stable
            amount: Number(data.amount ?? 0),
            occurred_at: data.occurred_at,
            category_id: data.category_id,
            payee: data.payee,
            payment_method: data.payment_method,
            notes: data.notes,
            pending: false,
            conflict: false,
            baseVersion: data.updated_at ? Date.parse(data.updated_at) : null,
            lastSyncedAt: new Date().toISOString(),
          }
        }
      }

      // If not restored from server, simply drop pending flag and reset form to tx values
      if (!restored) {
        restored = { ...tx, pending: false }
      }

      await txStore.setItem<LocalTransaction>(tx.id, restored)
      setTx(restored)
      const resetForm = {
        amount: restored.amount.toString(),
        occurred_at: isoToLocalInput(restored.occurred_at),
        category_id: restored.category_id ?? '',
        payee: restored.payee ?? '',
        payment_method: restored.payment_method ?? 'card',
        notes: restored.notes ?? '',
      }
      setForm(resetForm)
      initialRef.current = resetForm
      setReceiptFile(null)

      // Clean related UPDATE_TRANSACTION items from queue (optional but helpful)
      const toRemove: string[] = []
      await queueStore.iterate<QueueItem, void>((value, key) => {
        if (
          value &&
          value.type === 'UPDATE_TRANSACTION' &&
          ((value.ref.localId && value.ref.localId === tx.id) || (value.ref.remoteId && value.ref.remoteId === (tx.remoteId || (!isLocalId(tx.id) ? tx.id : undefined))))
        ) {
          toRemove.push(key)
        }
      })
      await Promise.all(toRemove.map((k) => queueStore.removeItem(k)))

      showToast('로컬 변경이 폐기되었어요.', 'info')
    } catch (e: any) {
      console.error(e)
      setError('로컬 변경 폐기 중 오류가 발생했어요.')
      showToast('폐기 중 오류가 발생했어요.', 'error')
    } finally {
      setSaving(false)
    }
  }, [tx, online, showToast])

  const headerBadges = (
    <div className="flex items-center gap-2">
      {tx?.pending && (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">대기 중</span>
      )}
      {tx?.conflict && (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">충돌</span>
      )}
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          online ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-500' : 'bg-gray-400')} />
        {online ? '온라인' : '오프라인'}
      </span>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!tx) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">거래 편집</h1>
          {headerBadges}
        </div>
        <Alert variant="destructive">
          <AlertTitle>거래를 찾을 수 없어요</AlertTitle>
          <AlertDescription>
            {error || '이 거래는 로컬 캐시에 존재하지 않아요. 홈 화면으로 돌아가 다시 시도해 주세요.'}
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/')} 
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            홈으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">거래 편집</h1>
          <p className="mt-1 text-sm text-muted-foreground">변경 후 저장하면 동기화 대기열에 추가돼요.</p>
        </div>
        {headerBadges}
      </div>

      {!online && (
        <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTitle>오프라인 모드</AlertTitle>
          <AlertDescription>변경 사항은 로컬에 저장되고, 온라인으로 전환되면 자동으로 동기화돼요.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!saving) onSubmit()
          }}
        >
          {/* Amount */}
          <div className="grid gap-2">
            <label htmlFor="amount" className="text-sm font-medium">
              금액 (KRW)
            </label>
            <div className="relative">
              <input
                id="amount"
                inputMode="numeric"
                pattern="[0-9]*"
                className="h-11 w-full rounded-lg border border-input bg-background px-4 pr-24 text-base outline-none ring-offset-background transition focus:ring-2 focus:ring-primary/30"
                placeholder="예: 12,000"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value.replace(/[^\d]/g, ''))}
                aria-describedby="amount-help"
              />
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">원</div>
            </div>
            <div id="amount-help" className="text-xs text-muted-foreground">
              {amountNumber > 0 ? `미리보기: ${formatKRW(amountNumber)}` : '숫자만 입력해 주세요'}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Date/Time */}
            <div className="grid gap-2">
              <label htmlFor="occurred_at" className="text-sm font-medium">
                결제 시각
              </label>
              <input
                id="occurred_at"
                type="datetime-local"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none ring-offset-background transition focus:ring-2 focus:ring-primary/30"
                value={form.occurred_at}
                onChange={(e) => setField('occurred_at', e.target.value)}
                required
              />
            </div>

            {/* Category */}
            <div className="grid gap-2">
              <label htmlFor="category" className="text-sm font-medium">
                카테고리
              </label>
              <select
                id="category"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none ring-offset-background transition focus:ring-2 focus:ring-primary/30"
                value={form.category_id ?? ''}
                onChange={(e) => setField('category_id', e.target.value || '')}
              >
                <option value="">분류 없음</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payee */}
          <div className="grid gap-2">
            <label htmlFor="payee" className="text-sm font-medium">
              가맹점/수취인
            </label>
            <input
              id="payee"
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none ring-offset-background transition focus:ring-2 focus:ring-primary/30"
              placeholder="예: 스타벅스"
              value={form.payee}
              onChange={(e) => setField('payee', e.target.value)}
            />
          </div>

          {/* Payment Method */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">결제 수단</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  onClick={() => setField('payment_method', m.value)}
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition',
                    form.payment_method === m.value
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                  )}
                  aria-pressed={form.payment_method === m.value}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <label htmlFor="notes" className="text-sm font-medium">
              메모
            </label>
            <textarea
              id="notes"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none ring-offset-background transition focus:ring-2 focus:ring-primary/30"
              placeholder="상세 메모를 남겨 보세요"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </div>

          <Separator />

          {/* Receipt */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">영수증</label>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setReceiptFile(f)
                  }}
                />
                <span>영수증 첨부/교체</span>
              </label>
              <div className="text-sm text-muted-foreground">
                {receiptFile
                  ? `${receiptFile.name} • ${(receiptFile.size / 1024).toFixed(1)}KB`
                  : tx.receipt_url
                  ? '기존 영수증이 연결되어 있어요'
                  : '선택된 파일 없음'}
                {tx.receiptPending && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">업로드 대기</span>}
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="pointer-events-none sticky bottom-0 -mx-4 -mb-4 mt-2 h-16 bg-gradient-to-t from-background/90 to-background/0" />
          <div className="sticky bottom-4 z-10 -mx-1 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving || !hasChanges}
              className={cn(
                'flex-1 rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {saving ? '저장 중...' : '변경 사항 저장'}
            </button>
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className={cn(
                'flex-1 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              로컬 변경 폐기
            </button>
            <button
              type="button"
              onClick={() => router.push(`/transactions/${id}`)}
              className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              취소
            </button>
          </div>
        </form>
      </div>

      {/* Helpful links */}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <button
          className="underline-offset-4 hover:underline"
          onClick={() => router.push(`/transactions/${id}`)}
        >
          상세 보기
        </button>
        <span>•</span>
        <button className="underline-offset-4 hover:underline" onClick={() => router.push('/queue')}>
          동기화 대기열
        </button>
        <span>•</span>
        <button className="underline-offset-4 hover:underline" onClick={() => router.push('/conflicts')}>
          충돌 관리
        </button>
      </div>
    </div>
  )
}
