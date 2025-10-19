'use client'

/**
 * CODE INSIGHT
 * Client UI for Calendar page. Manages local month/week view state, computes ranges,
 * fetches occurrences via server actions, and displays a responsive calendar with
 * day-level bottom sheet actions to manage occurrences. Emphasizes mobile-first UX,
 * KRW currency formatting, progressive disclosure, and subtle motion.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/utils/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getOccurrencesRange,
  generateOccurrences,
  payOccurrence,
  patchOccurrence,
} from './action'

type ViewMode = 'month' | 'week'

type OccurrenceStatus = 'upcoming' | 'confirmed' | 'paid' | 'skipped' | 'snoozed'

interface OccurrenceRule {
  id: string
  title?: string | null
  amount?: number | null
  category_id?: string | null
}

interface RawOccurrence {
  id: string
  rule_id?: string
  recurring_transaction_id?: string
  due_at?: string
  occurs_on?: string
  status: OccurrenceStatus
  transaction_id?: string | null
  amount?: number | null
  rule?: OccurrenceRule | null
}

interface Occurrence {
  id: string
  rule_id: string
  due_at: string
  status: OccurrenceStatus
  transaction_id?: string | null
  amount?: number | null
  rule?: OccurrenceRule | null
}

function adaptOccurrence(raw: RawOccurrence): Occurrence {
  const rule_id = raw.rule_id || raw.recurring_transaction_id || ''
  const due_at = raw.due_at || raw.occurs_on || new Date().toISOString()
  return {
    id: raw.id,
    rule_id,
    due_at,
    status: raw.status,
    transaction_id: raw.transaction_id,
    amount: raw.amount ?? raw.rule?.amount ?? null,
    rule: raw.rule ?? null,
  }
}

function toISODate(d: Date) {
  const year = d.getFullYear()
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(d: Date) {
  const day = d.getDay() // 0 Sun
  const diff = day // week starts Sunday
  const r = new Date(d)
  r.setDate(d.getDate() - diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfWeek(d: Date) {
  const s = startOfWeek(d)
  const e = new Date(s)
  e.setDate(s.getDate() + 6)
  e.setHours(23, 59, 59, 999)
  return e
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function addMonths(d: Date, n: number) {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function formatMonthYear(d: Date) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(d)
}

function formatWeekRange(d: Date) {
  const s = startOfWeek(d)
  const e = endOfWeek(d)
  const fmt = new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' })
  return `${fmt.format(s)} - ${fmt.format(e)}`
}

function formatKRW(amount?: number | null) {
  if (amount == null) return '₩—'
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount)
}

function dayKeyFromISO(iso: string) {
  const d = new Date(iso)
  // normalize to local date boundary
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function statusColor(status: OccurrenceStatus) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-500 text-emerald-50'
    case 'confirmed':
      return 'bg-indigo-500 text-indigo-50'
    case 'snoozed':
      return 'bg-amber-500 text-amber-50'
    case 'skipped':
      return 'bg-muted text-muted-foreground'
    case 'upcoming':
    default:
      return 'bg-primary text-primary-foreground'
  }
}

interface Props {
  userDisplayName?: string
}

export default function CalendarClient({ userDisplayName }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [view, setView] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Occurrence[]>([])

  const [adminVisible, setAdminVisible] = useState<boolean>(false)
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetDateKey, setSheetDateKey] = useState<string>('')

  // Pay modal state
  const [payOpen, setPayOpen] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState<string>('')
  const [payDate, setPayDate] = useState<string>('') // datetime-local

  // Snooze modal state
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [snoozingId, setSnoozingId] = useState<string | null>(null)
  const [snoozeDate, setSnoozeDate] = useState<string>('')

  const [toast, setToast] = useState<{ title: string; description?: string; type?: 'success' | 'error' } | null>(null)
  const toastTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const adminParam = searchParams?.get('admin')
    const dev = process.env.NODE_ENV !== 'production'
    setAdminVisible(dev || adminParam === '1')
  }, [searchParams])

  useEffect(() => {
    function onOnline() { setOnline(true) }
    function onOffline() { setOnline(false) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const range = useMemo(() => {
    if (view === 'month') {
      const mStart = startOfMonth(selectedDate)
      const mEnd = endOfMonth(selectedDate)
      const from = startOfWeek(mStart)
      const to = endOfWeek(mEnd)
      return { from, to }
    }
    const from = startOfWeek(selectedDate)
    const to = endOfWeek(selectedDate)
    return { from, to }
  }, [selectedDate, view])

  const rangeISO = useMemo(() => ({ from: toISODate(range.from), to: toISODate(range.to) }), [range])

  const fetchOccurrences = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getOccurrencesRange({ from: rangeISO.from, to: rangeISO.to, status: 'upcoming' })
      const enriched = Array.isArray(data) ? data.map(adaptOccurrence) : []
      setItems(enriched)
    } catch (e: any) {
      console.error(e)
      setError('일정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }, [rangeISO])

  useEffect(() => {
    fetchOccurrences()
  }, [fetchOccurrences])

  const dayMap = useMemo(() => {
    const map = new Map<string, Occurrence[]>()
    for (const it of items) {
      const k = dayKeyFromISO(it.due_at)
      const arr = map.get(k) || []
      arr.push(it)
      map.set(k, arr)
    }
    return map
  }, [items])

  const daySum = useCallback((k: string) => {
    const arr = dayMap.get(k) || []
    return arr.reduce((acc, it) => acc + (typeof it.amount === 'number' ? it.amount : 0), 0)
  }, [dayMap])

  const days = useMemo(() => {
    const out: { date: Date; key: string; inMonth: boolean }[] = []
    let cursor = new Date(range.from)
    while (cursor <= range.to) {
      const key = toISODate(cursor)
      out.push({ date: new Date(cursor), key, inMonth: cursor.getMonth() === selectedDate.getMonth() })
      cursor = addDays(cursor, 1)
    }
    return out
  }, [range, selectedDate])

  function openSheetForDay(k: string) {
    setSheetDateKey(k)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setSheetDateKey('')
  }

  function openPay(occ: Occurrence) {
    setPayingId(occ.id)
    const amt = (occ.amount ?? 0).toString()
    setPayAmount(amt)
    // default to due_at as local datetime-local string
    const d = new Date(occ.due_at)
    const dtLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setPayDate(dtLocal)
    setPayOpen(true)
  }

  function closePay() {
    setPayOpen(false)
    setPayingId(null)
  }

  function openSnooze(occ: Occurrence) {
    setSnoozingId(occ.id)
    const d = new Date(occ.due_at)
    const dtLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setSnoozeDate(dtLocal)
    setSnoozeOpen(true)
  }

  function closeSnooze() {
    setSnoozeOpen(false)
    setSnoozingId(null)
  }

  function showToast(msg: { title: string; description?: string; type?: 'success' | 'error' }) {
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    setToast(msg)
    toastTimeout.current = setTimeout(() => setToast(null), 2600)
  }

  async function onGenerate() {
    try {
      await generateOccurrences({ from: rangeISO.from, to: rangeISO.to })
      await fetchOccurrences()
      showToast({ title: '생성 완료', description: '표시 범위의 발생 건을 생성했어요.', type: 'success' })
    } catch (e) {
      showToast({ title: '생성 실패', description: '다시 시도해 주세요.', type: 'error' })
    }
  }

  async function onConfirm(id: string) {
    try {
      const res = await patchOccurrence(id, { action: 'confirm' })
      if (res) {
        await fetchOccurrences()
        showToast({ title: '확정됨', description: '발생 건을 확정했어요.', type: 'success' })
      }
    } catch (e) {
      showToast({ title: '오류', description: '확정에 실패했어요.', type: 'error' })
    }
  }

  async function onSkip(id: string) {
    try {
      const res = await patchOccurrence(id, { action: 'skip' })
      if (res) {
        await fetchOccurrences()
        showToast({ title: '건너뜀', description: '이번 발생 건을 건너뛰었어요.', type: 'success' })
      }
    } catch (e) {
      showToast({ title: '오류', description: '건너뛰기에 실패했어요.', type: 'error' })
    }
  }

  async function onSnooze() {
    if (!snoozingId || !snoozeDate) return
    try {
      const iso = new Date(snoozeDate)
      const res = await patchOccurrence(snoozingId, { action: 'snooze', new_date: iso.toISOString() })
      if (res) {
        closeSnooze()
        await fetchOccurrences()
        showToast({ title: '미루기 완료', description: '새 일정으로 이동했어요.', type: 'success' })
      }
    } catch (e) {
      showToast({ title: '오류', description: '미루기에 실패했어요.', type: 'error' })
    }
  }

  async function onPay() {
    if (!payingId) return
    try {
      const amount = Number(payAmount)
      const paidAtISO = new Date(payDate).toISOString()
      const res = await payOccurrence(payingId, { amount, paid_at: paidAtISO })
      if (res) {
        closePay()
        await fetchOccurrences()
        showToast({ title: '결제 완료', description: '지출이 기록되었어요.', type: 'success' })
      }
    } catch (e) {
      showToast({ title: '오류', description: '결제 처리에 실패했어요.', type: 'error' })
    }
  }

  const todayKey = toISODate(new Date())

  const sheetList = useMemo(() => {
    if (!sheetDateKey) return [] as Occurrence[]
    return (dayMap.get(sheetDateKey) || []).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
  }, [dayMap, sheetDateKey])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold tracking-tight">캘린더</h1>
          <p className="text-sm text-muted-foreground">{userDisplayName ? `${userDisplayName} 님의 반복 결제 일정` : '반복 결제 일정'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', online ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300')}>
            {online ? 'Online' : 'Offline'}
          </span>
          <a href="/upcoming" className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:opacity-90 transition">수신함</a>
          <a href="/recurring" className="hidden sm:inline-flex rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 transition">규칙 관리</a>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            aria-label="previous"
            onClick={() => setSelectedDate(prev => view === 'month' ? addMonths(prev, -1) : addDays(prev, -7))}
            className="rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
          >
            ←
          </button>
          <button
            aria-label="today"
            onClick={() => setSelectedDate(new Date())}
            className="rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
          >
            오늘
          </button>
          <button
            aria-label="next"
            onClick={() => setSelectedDate(prev => view === 'month' ? addMonths(prev, 1) : addDays(prev, 7))}
            className="rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setView('month')}
            className={cn('rounded-md px-3 py-1.5 text-sm transition', view === 'month' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >월</button>
          <button
            onClick={() => setView('week')}
            className={cn('rounded-md px-3 py-1.5 text-sm transition', view === 'week' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >주</button>
        </div>
      </div>

      {/* Title */}
      <div className="mb-2 text-sm text-muted-foreground">
        {view === 'month' ? formatMonthYear(selectedDate) : formatWeekRange(selectedDate)}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {['일','월','화','수','목','금','토'].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {loading ? (
          Array.from({ length: (view === 'month' ? 42 : 7) }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))
        ) : (
          days.map(({ date, key, inMonth }) => {
            const sum = daySum(key)
            const occurrences = dayMap.get(key) || []
            const isToday = key === todayKey
            return (
              <button
                type="button"
                key={key}
                onClick={() => occurrences.length > 0 && openSheetForDay(key)}
                className={cn(
                  'group relative flex h-24 flex-col rounded-lg border p-2 text-left transition-colors',
                  inMonth ? 'bg-card hover:bg-accent' : 'bg-muted/30 text-muted-foreground',
                  isToday && 'ring-2 ring-primary'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm font-medium', isToday && 'text-primary')}>{date.getDate()}</span>
                  {sum > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {formatKRW(sum)}
                    </span>
                  )}
                </div>
                {/* dots representing occurrences */}
                <div className="mt-auto flex flex-wrap gap-1">
                  {occurrences.slice(0, 5).map(o => (
                    <span key={o.id} className={cn('h-2 w-2 rounded-full',
                      o.status === 'paid' ? 'bg-emerald-500' :
                      o.status === 'confirmed' ? 'bg-indigo-500' :
                      o.status === 'snoozed' ? 'bg-amber-500' :
                      o.status === 'skipped' ? 'bg-muted-foreground' : 'bg-primary')}></span>
                  ))}
                  {occurrences.length > 5 && (
                    <span className="text-[10px] text-muted-foreground">+{occurrences.length - 5}</span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="mt-4">
          <Alert variant="destructive">
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Generate occurrences (dev/admin only) */}
      {adminVisible && (
        <div className="mt-6">
          <button
            onClick={onGenerate}
            className="w-full rounded-lg bg-secondary px-4 py-2 text-secondary-foreground hover:opacity-90 transition"
          >
            표시 범위 발생 건 생성
          </button>
        </div>
      )}

      {/* Bottom sheet */}
      <div className={cn('fixed inset-0 z-40', sheetOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        {/* overlay */}
        <div
          className={cn('absolute inset-0 bg-black/40 transition-opacity', sheetOpen ? 'opacity-100' : 'opacity-0')}
          onClick={closeSheet}
          aria-hidden
        />
        {/* sheet */}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 max-h-[80%] rounded-t-2xl border-t border-border bg-background shadow-2xl transition-transform',
            sheetOpen ? 'translate-y-0' : 'translate-y-full'
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-muted mt-2" />
          <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">선택한 날짜</div>
                <div className="text-lg font-semibold tracking-tight">{sheetDateKey || ''}</div>
              </div>
              <button onClick={closeSheet} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">닫기</button>
            </div>

            {sheetList.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">이 날짜에는 항목이 없어요.</div>
            ) : (
              <div className="space-y-2">
                {sheetList.map((o) => (
                  <div key={o.id} className="rounded-xl border bg-card p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', statusColor(o.status))}>{o.status}</div>
                          {o.transaction_id && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">거래 연결됨</span>
                          )}
                        </div>
                        <div className="mt-1 truncate text-sm font-medium">
                          {o.rule?.title || '반복 항목'}
                        </div>
                        <div className="text-xs text-muted-foreground">{new Date(o.due_at).toLocaleString('ko-KR')}</div>
                      </div>
                      <div className="shrink-0 text-right text-base font-semibold tabular-nums">{formatKRW(o.amount)}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {o.status !== 'paid' && (
                        <button onClick={() => openPay(o)} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 transition">결제 완료</button>
                      )}
                      {o.status === 'upcoming' || o.status === 'snoozed' ? (
                        <button onClick={() => onConfirm(o.id)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">확정</button>
                      ) : null}
                      {o.status !== 'paid' && (
                        <button onClick={() => openSnooze(o)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">미루기</button>
                      )}
                      {o.status !== 'paid' && (
                        <button onClick={() => onSkip(o.id)} className="rounded-md border border-destructive text-destructive px-3 py-1.5 text-sm hover:bg-destructive/10">건너뛰기</button>
                      )}
                      <button onClick={() => router.push(`/recurring/${o.rule_id}`)} className="ml-auto rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:opacity-90">규칙 보기</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pay modal */}
      <div className={cn('fixed inset-0 z-50', payOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div className={cn('absolute inset-0 bg-black/40 transition-opacity', payOpen ? 'opacity-100' : 'opacity-0')} onClick={closePay} />
        <div className={cn('absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl border bg-background p-4 shadow-xl transition-transform md:inset-x-auto md:left-1/2 md:w-[420px] md:-translate-x-1/2', payOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0')}>
          <div className="mb-2 text-base font-semibold">결제 처리</div>
          <div className="space-y-3">
            <div className="grid gap-1">
              <label className="text-sm text-muted-foreground">금액</label>
              <input
                inputMode="numeric"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value.replace(/[^0-9]/g, ''))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="금액"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm text-muted-foreground">결제 시각</label>
              <input
                type="datetime-local"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button onClick={onPay} className="flex-1 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90">저장</button>
              <button onClick={closePay} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">취소</button>
            </div>
          </div>
        </div>
      </div>

      {/* Snooze modal */}
      <div className={cn('fixed inset-0 z-50', snoozeOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div className={cn('absolute inset-0 bg-black/40 transition-opacity', snoozeOpen ? 'opacity-100' : 'opacity-0')} onClick={closeSnooze} />
        <div className={cn('absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl border bg-background p-4 shadow-xl transition-transform md:inset-x-auto md:left-1/2 md:w-[420px] md:-translate-x-1/2', snoozeOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0')}>
          <div className="mb-2 text-base font-semibold">미루기</div>
          <div className="space-y-3">
            <div className="grid gap-1">
              <label className="text-sm text-muted-foreground">새 일정 시각</label>
              <input
                type="datetime-local"
                value={snoozeDate}
                onChange={(e) => setSnoozeDate(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button onClick={onSnooze} className="flex-1 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90">저장</button>
              <button onClick={closeSnooze} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">취소</button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={cn('pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 transition', toast ? 'opacity-100' : 'opacity-0')}>
        {toast && (
          <div className={cn('pointer-events-auto w-full max-w-sm rounded-lg border p-3 shadow-lg', toast.type === 'error' ? 'border-destructive/30 bg-destructive/10' : 'border-emerald-300/30 bg-emerald-500/10') }>
            <div className="text-sm font-semibold">{toast.title}</div>
            {toast.description && <div className="text-xs text-muted-foreground">{toast.description}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
