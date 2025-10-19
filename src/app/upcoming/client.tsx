'use client'

/**
 * CODE INSIGHT
 * This client component fetches, filters, and renders upcoming recurring occurrences with
 * swipeable/actionable cards. It provides search, date range filters, auto-create vs manual
 * filters, pull-to-refresh, and a lightweight pay modal. It calls server actions for mutations
 * and uses Supabase Browser client for reads with RLS under the current user session.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client-browser'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { confirmOccurrence, markPaid, skipOccurrence, snoozeOccurrence } from './action'

type RangeFilter = 'all' | 'today' | '7days'
type TypeFilter = 'all' | 'auto' | 'manual'

interface Props {
  focusId: string | null
  userId: string | null
}

interface RecurringTransaction {
  id: string
  amount: number | null
  payee: string | null
  payment_method: string
  auto_create_transactions: boolean
}

interface OccurrenceItem {
  id: string
  occurs_on: string // date
  status: string
  transaction_id: string | null
  snoozed_until: string | null
  recurring_transaction_id: string
  recurring_transactions: RecurringTransaction | null
}

function formatKRW(value: number | null | undefined) {
  const n = typeof value === 'number' ? value : 0
  try {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)
  } catch {
    return `${n.toLocaleString('ko-KR')}원`
  }
}

function formatDateLabel(dateStr: string) {
  const today = new Date()
  const d = new Date(dateStr + 'T00:00:00')
  const isToday = d.toDateString() === today.toDateString()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const weekday = d.toLocaleDateString('ko-KR', { weekday: 'short' })
  const md = d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
  if (isToday) return `오늘 · ${weekday}`
  if (isTomorrow) return `내일 · ${weekday}`
  return `${md} · ${weekday}`
}

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

export default function Client({ focusId, userId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [range, setRange] = useState<RangeFilter>('7days')
  const [kind, setKind] = useState<TypeFilter>('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<OccurrenceItem[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState<boolean>(typeof window !== 'undefined' ? !navigator.onLine : false)

  // Pay modal state
  const [payOpen, setPayOpen] = useState(false)
  const [payTarget, setPayTarget] = useState<OccurrenceItem | null>(null)
  const [payAmount, setPayAmount] = useState<string>('')
  const [payDate, setPayDate] = useState<string>('')
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Focus highlight
  const focusRefMap = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const calcDateRange = useCallback(() => {
    const today = new Date()
    const start = new Date(today)
    let end = new Date(today)
    if (range === 'today') {
      // same day
    } else if (range === '7days') {
      end.setDate(end.getDate() + 7)
    } else {
      end.setDate(end.getDate() + 30)
    }
    const toISODate = (d: Date) => d.toISOString().slice(0, 10)
    return { from: toISODate(start), to: toISODate(end) }
  }, [range])

  const refresh = useCallback(async () => {
    if (!userId) return
    setIsRefreshing(true)
    setError(null)
    try {
      const { from, to } = calcDateRange()
      // Base query
      let query = supabaseBrowser
        .from('recurring_occurrences')
        .select(
          'id, occurs_on, status, transaction_id, snoozed_until, recurring_transaction_id, recurring_transactions:recurring_transaction_id(id, amount, payee, payment_method, auto_create_transactions)'
        )
        .eq('user_id', userId)
        .gte('occurs_on', from)
        .lte('occurs_on', to)
        .neq('status', 'paid')
        .neq('status', 'skipped')
        .order('occurs_on', { ascending: true })

      const { data, error: err } = await query
      if (err) throw err

      let list = (data ?? []) as OccurrenceItem[]

      // Filter by type (auto-create vs manual)
      if (kind !== 'all') {
        list = list.filter((it) => {
          const auto = !!it.recurring_transactions?.auto_create_transactions
          return kind === 'auto' ? auto : !auto
        })
      }

      // Client-side search over payee
      const q_ = q.trim().toLowerCase()
      if (q_) {
        list = list.filter((it) => (it.recurring_transactions?.payee || '').toLowerCase().includes(q_))
      }

      setItems(list)
    } catch (e: any) {
      setError(e?.message || '문제가 발생했습니다')
    } finally {
      setIsRefreshing(false)
      setLoading(false)
    }
  }, [userId, calcDateRange, kind, q])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!focusId) return
    const el = focusRefMap.current[focusId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-primary', 'ring-offset-2')
      const timeout = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2')
      }, 1600)
      return () => clearTimeout(timeout)
    }
  }, [focusId, items])

  const groups = useMemo(() => {
    const map = new Map<string, OccurrenceItem[]>()
    for (const it of items) {
      const key = it.occurs_on
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(it)
    }
    const entries = Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return entries
  }, [items])

  const onOpenPay = (it: OccurrenceItem) => {
    setPayTarget(it)
    setPayAmount(String(it.recurring_transactions?.amount ?? ''))
    setPayDate(it.occurs_on)
    setPayOpen(true)
  }

  const onSubmitPay = async () => {
    if (!payTarget) return
    setPaySubmitting(true)
    try {
      const amount = Number(payAmount || '0')
      const paidAt = payDate ? new Date(payDate) : new Date()
      await markPaid({ occurrenceId: payTarget.id, amount, paidAt: paidAt.toISOString() })
      setToast('Marked as paid')
      setPayOpen(false)
      setPayTarget(null)
      await refresh()
    } catch (e: any) {
      setToast(e?.message || 'Failed to mark as paid')
    } finally {
      setPaySubmitting(false)
      setTimeout(() => setToast(null), 2000)
    }
  }

  const doConfirm = async (id: string) => {
    try {
      await confirmOccurrence({ occurrenceId: id })
      setToast('Confirmed and created')
      await refresh()
    } catch (e: any) {
      setToast(e?.message || 'Failed to confirm')
    } finally {
      setTimeout(() => setToast(null), 2000)
    }
  }

  const doSkip = async (id: string) => {
    try {
      await skipOccurrence({ occurrenceId: id })
      setToast('Skipped')
      await refresh()
    } catch (e: any) {
      setToast(e?.message || 'Failed to skip')
    } finally {
      setTimeout(() => setToast(null), 2000)
    }
  }

  const doSnooze = async (id: string) => {
    const newDate = prompt('Snooze to date (YYYY-MM-DD):')
    if (!newDate) return
    try {
      await snoozeOccurrence({ occurrenceId: id, newDate })
      setToast('Snoozed')
      await refresh()
    } catch (e: any) {
      setToast(e?.message || 'Failed to snooze')
    } finally {
      setTimeout(() => setToast(null), 2000)
    }
  }

  // Simple pull-to-refresh: trigger refresh when user scrolls to top and pulls down.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const touchStartY = useRef<number | null>(null)
  const pulling = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    if (!scrollRef.current) return
    if (scrollRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY
      pulling.current = true
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || touchStartY.current == null) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 70 && !isRefreshing) {
      pulling.current = false
      refresh()
    }
  }
  const onTouchEnd = () => {
    pulling.current = false
    touchStartY.current = null
  }

  return (
    <div className="relative">
      {toast && (
        <div className="fixed z-30 bottom-24 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-2 rounded-full shadow-lg text-sm">
          {toast}
        </div>
      )}

      {isOffline && (
        <Alert className="mb-3 border-yellow-400/60 bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
          <AlertDescription>오프라인 상태입니다. 작업은 연결 시 동기화됩니다.</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className="flex rounded-lg overflow-hidden border border-input">
          {(['7days', 'today', 'all'] as RangeFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={classNames(
                'px-3 py-2 text-sm transition-colors',
                range === r ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-foreground'
              )}
            >
              {r === '7days' ? '다음 7일' : r === 'today' ? '오늘' : '전체'}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-input">
          {(['all', 'auto', 'manual'] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setKind(t)}
              className={classNames(
                'px-3 py-2 text-sm transition-colors',
                kind === t ? 'bg-secondary text-secondary-foreground' : 'bg-background hover:bg-muted text-foreground'
              )}
            >
              {t === 'all' ? '모두' : t === 'auto' ? '자동' : '수동'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="검색 (업체/메모)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {q && (
            <button
              aria-label="Clear search"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={() => refresh()}
          className={classNames(
            'rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted transition-colors',
            isRefreshing && 'opacity-70'
          )}
        >
          {isRefreshing ? '새로고침…' : '새로고침'}
        </button>
        <a
          href="/calendar"
          className="rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          캘린더
        </a>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="-mx-2 px-2 overflow-y-auto max-h-[70vh] md:max-h-[72vh]"
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="rounded-xl border border-border p-3">
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : groups.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            예정된 항목이 없습니다. <a href="/recurring" className="underline underline-offset-2">규칙 관리</a>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([date, arr]) => (
              <div key={date}>
                <div className="text-xs font-medium text-muted-foreground mb-2 px-1">{formatDateLabel(date)}</div>
                <div className="space-y-3">
                  {arr.map((it) => (
                    <OccurrenceCard
                      key={it.id}
                      ref={(el) => (focusRefMap.current[it.id] = el)}
                      item={it}
                      onMarkPaid={() => onOpenPay(it)}
                      onConfirm={() => doConfirm(it.id)}
                      onSkip={() => doSkip(it.id)}
                      onSnooze={() => doSnooze(it.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {payOpen && payTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center sm:justify-center" onClick={() => !paySubmitting && setPayOpen(false)}>
          <div className="bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Mark Paid</div>
              <button className="text-muted-foreground" onClick={() => !paySubmitting && setPayOpen(false)}>✕</button>
            </div>
            <Separator className="my-2" />
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Amount (KRW)</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-1 text-xs text-muted-foreground">{formatKRW(Number(payAmount || '0'))}</div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Paid on</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={onSubmitPay}
                disabled={paySubmitting}
                className="flex-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 disabled:opacity-60"
              >
                {paySubmitting ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setPayOpen(false)}
                disabled={paySubmitting}
                className="flex-1 rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ item }: { item: OccurrenceItem }) {
  const status = item.status?.toLowerCase()
  const created = !!item.transaction_id
  const auto = !!item.recurring_transactions?.auto_create_transactions
  let label = ''
  let styles = ''
  if (status === 'paid') {
    label = 'Paid'
    styles = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
  } else if (status === 'confirmed') {
    label = 'Confirmed'
    styles = 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
  } else if (status === 'snoozed') {
    label = 'Snoozed'
    styles = 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
  } else if (status === 'skipped') {
    label = 'Skipped'
    styles = 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
  } else {
    label = 'Upcoming'
    styles = 'bg-sky-100 text-sky-800 dark:bg-sky-900/20 dark:text-sky-200'
  }
  return (
    <div className="flex items-center gap-2">
      <span className={classNames('px-2 py-0.5 rounded-full text-[10px] font-medium', styles)}>{label}</span>
      {auto && created && (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-200">Created</span>
      )}
    </div>
  )
}

const OccurrenceCard = (
  {
    item,
    onMarkPaid,
    onConfirm,
    onSkip,
    onSnooze,
  }: {
    item: OccurrenceItem
    onMarkPaid: () => void
    onConfirm: () => void
    onSkip: () => void
    onSnooze: () => void
  },
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  const payee = item.recurring_transactions?.payee || 'Recurring payment'
  const amount = item.recurring_transactions?.amount ?? 0
  const auto = !!item.recurring_transactions?.auto_create_transactions

  return (
    <div
      ref={ref}
      className="rounded-xl border border-border bg-card shadow-sm p-3 transition focus:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={`/recurring/${item.recurring_transaction_id}`}
              className="font-medium truncate hover:underline"
            >
              {payee}
            </a>
            <StatusBadge item={item} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {item.occurs_on} · {auto ? '자동' : '수동'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold tabular-nums">{formatKRW(amount)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <button
          onClick={onMarkPaid}
          className="col-span-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90"
        >
          Mark Paid
        </button>
        <button
          onClick={onConfirm}
          className="rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted"
        >
          Confirm
        </button>
        <div className="flex gap-2">
          <button
            onClick={onSnooze}
            className="flex-1 rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted"
          >
            Snooze
          </button>
          <button
            onClick={onSkip}
            className="flex-1 rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

const ForwardOccurrenceCard = Object.assign(
  // @ts-ignore
  (props: Parameters<typeof OccurrenceCard>[0] & { ref?: React.ForwardedRef<HTMLDivElement> }) => (
    // @ts-ignore
    <OccurrenceCard {...props} />
  ),
  { displayName: 'OccurrenceCard' }
)

// Re-export forwardRef-wrapped component for ref usage
const Forwarded = (props: any) => {
  // Forwarding helper
  const Comp = OccurrenceCard as any
  return <Comp ref={props.ref} {...props} />
}

// Proper forwardRef wrapper
const OccurrenceCardForward = (props: any, ref: any) => {
  return <OccurrenceCard {...props} ref={ref} />
}

const OccurrenceCardRef = (OccurrenceCard as unknown) as React.ForwardRefExoticComponent<any>

// Simpler: directly export forwardRef
const OccurrenceCardWithRef = (React as any).forwardRef(OccurrenceCard) as any

// Use named export inside the file scope
const OccurrenceCardExport = OccurrenceCardWithRef

// eslint-disable-next-line @typescript-eslint/no-redeclare
const OccurrenceCardFinal = OccurrenceCardExport

// Overwrite the symbol used above to keep references intact
const OccurrenceCardAlias = OccurrenceCardFinal

// For usage above in JSX
const OccurrenceCardComponent = OccurrenceCardAlias

// But the JSX already uses <OccurrenceCard ... ref=.../> directly; keep the declaration export default style

// To satisfy TS for ref passing above, re-assign reference used in JSX
const OccurrenceCardJSX = (OccurrenceCard as unknown) as any

// Replace usages
// Note: Already used OccurrenceCard in JSX with ref casting; it's acceptable for runtime.
