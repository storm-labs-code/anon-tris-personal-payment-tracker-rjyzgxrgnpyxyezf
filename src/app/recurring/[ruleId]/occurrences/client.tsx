'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client-browser'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/utils'

export interface OccurrencesClientProps {
  ruleId: string
  defaultAmount: number
  autoCreate: boolean
  payee: string
  paymentMethod: string
  categoryId: string
}

type Occurrence = {
  id: string
  occurs_on: string // date
  status: 'upcoming' | 'confirmed' | 'paid' | 'skipped' | 'snoozed' | string
  transaction_id: string | null
  snoozed_until: string | null
}

type Transaction = {
  id: string
  amount: number
  occurred_at: string
  category_id: string | null
  payee: string | null
  payment_method: string
  notes: string | null
}

export function OccurrencesClient(props: OccurrencesClientProps) {
  const { ruleId, defaultAmount, autoCreate, payee, paymentMethod, categoryId } = props
  const router = useRouter()
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [txMap, setTxMap] = useState<Record<string, Transaction>>({})
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  const [pending, startTransition] = useTransition()
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null)

  useEffect(() => {
    let alive = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        // Load occurrences for this rule
        const { data: occs, error: occErr } = await supabaseBrowser
          .from('recurring_occurrences')
          .select('id, occurs_on, status, transaction_id, snoozed_until')
          .eq('recurring_transaction_id', ruleId)
          .order('occurs_on', { ascending: true })

        if (occErr) throw occErr
        if (!alive) return

        const occurrences = (occs || []) as Occurrence[]
        setOccurrences(occurrences)

        const txIds = occurrences.map((o) => o.transaction_id).filter(Boolean) as string[]
        if (txIds.length) {
          const { data: txs, error: txErr } = await supabaseBrowser
            .from('transactions')
            .select('id, amount, occurred_at, category_id, payee, payment_method, notes')
            .in('id', txIds)
          if (txErr) throw txErr
          if (!alive) return
          const map: Record<string, Transaction> = {}
          for (const t of txs || []) {
            map[t.id] = t as Transaction
          }
          setTxMap(map)
        } else {
          setTxMap({})
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load occurrences')
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [ruleId])

  const nowISO = useMemo(() => new Date().toISOString(), [])
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const filtered = useMemo(() => {
    const today = todayStr
    if (tab === 'upcoming') {
      return occurrences.filter((o) => {
        const isFutureOrToday = (o.occurs_on || '') >= today
        return isFutureOrToday && o.status !== 'paid' && o.status !== 'skipped'
      })
    }
    return occurrences.filter((o) => {
      return (o.occurs_on || '') < today || o.status === 'paid' || o.status === 'skipped'
    }).slice(-100)
  }, [occurrences, tab, todayStr])

  const formatKRW = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(Math.round(value || 0))
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + (dateStr.length <= 10 ? 'T00:00:00' : ''))
      return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', weekday: 'short' }).format(d)
    } catch {
      return dateStr
    }
  }

  const statusChip = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      upcoming: { label: 'Upcoming', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' },
      confirmed: { label: 'Confirmed', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
      paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' },
      skipped: { label: 'Skipped', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300' },
      snoozed: { label: 'Snoozed', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300' },
    }
    return map[status] || { label: status, cls: 'bg-muted text-muted-foreground' }
  }

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: occs, error: occErr } = await supabaseBrowser
        .from('recurring_occurrences')
        .select('id, occurs_on, status, transaction_id, snoozed_until')
        .eq('recurring_transaction_id', ruleId)
        .order('occurs_on', { ascending: true })
      if (occErr) throw occErr
      setOccurrences((occs || []) as Occurrence[])

      const txIds = (occs || []).map((o: any) => o.transaction_id).filter(Boolean)
      if (txIds.length) {
        const { data: txs, error: txErr } = await supabaseBrowser
          .from('transactions')
          .select('id, amount, occurred_at, category_id, payee, payment_method, notes')
          .in('id', txIds)
        if (txErr) throw txErr
        const map: Record<string, Transaction> = {}
        for (const t of txs || []) map[t.id] = t as Transaction
        setTxMap(map)
      } else {
        setTxMap({})
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to refresh')
    } finally {
      setLoading(false)
    }
  }

  const markPaid = async (occ: Occurrence, amount: number, paidAtISO?: string) => {
    try {
      const { data: auth } = await supabaseBrowser.auth.getUser()
      const user = auth?.user
      if (!user) throw new Error('Not authenticated')

      const insert = {
        user_id: user.id,
        amount: Math.round(amount || 0),
        occurred_at: paidAtISO || new Date().toISOString(),
        category_id: categoryId || null,
        payee: payee || null,
        payment_method: paymentMethod || 'cash',
        notes: `Paid for recurring on ${occ.occurs_on}`,
      }
      const { data: tx, error: txErr } = await supabaseBrowser
        .from('transactions')
        .insert(insert)
        .select('id, amount, occurred_at, category_id, payee, payment_method, notes')
        .single()
      if (txErr) throw txErr

      const { error: occErr } = await supabaseBrowser
        .from('recurring_occurrences')
        .update({ status: 'paid', transaction_id: tx.id })
        .eq('id', occ.id)
      if (occErr) throw occErr

      setOccurrences((prev) => prev.map((o) => (o.id === occ.id ? { ...o, status: 'paid', transaction_id: tx.id } : o)))
      setTxMap((prev) => ({ ...prev, [tx.id]: tx as Transaction }))
      setBanner({ type: 'success', title: 'Saved', message: 'Marked as paid.' })
    } catch (e: any) {
      setBanner({ type: 'error', title: 'Failed', message: e?.message || 'Unable to mark as paid.' })
    }
  }

  const confirmOcc = async (occ: Occurrence) => {
    try {
      const { error: occErr } = await supabaseBrowser
        .from('recurring_occurrences')
        .update({ status: 'confirmed' })
        .eq('id', occ.id)
      if (occErr) throw occErr
      setOccurrences((prev) => prev.map((o) => (o.id === occ.id ? { ...o, status: 'confirmed' } : o)))
      setBanner({ type: 'success', title: 'Confirmed', message: 'Occurrence confirmed.' })
    } catch (e: any) {
      setBanner({ type: 'error', title: 'Failed', message: e?.message || 'Unable to confirm.' })
    }
  }

  const skipOcc = async (occ: Occurrence) => {
    try {
      const { error: occErr } = await supabaseBrowser
        .from('recurring_occurrences')
        .update({ status: 'skipped' })
        .eq('id', occ.id)
      if (occErr) throw occErr
      setOccurrences((prev) => prev.map((o) => (o.id === occ.id ? { ...o, status: 'skipped' } : o)))
      setBanner({ type: 'success', title: 'Skipped', message: 'Occurrence skipped.' })
    } catch (e: any) {
      setBanner({ type: 'error', title: 'Failed', message: e?.message || 'Unable to skip.' })
    }
  }

  const snoozeOcc = async (occ: Occurrence, newDate: string) => {
    try {
      if (!newDate) throw new Error('Pick a snooze date')
      const { error: occErr } = await supabaseBrowser
        .from('recurring_occurrences')
        .update({ status: 'snoozed', snoozed_until: newDate, occurs_on: newDate })
        .eq('id', occ.id)
      if (occErr) throw occErr
      setOccurrences((prev) => prev.map((o) => (o.id === occ.id ? { ...o, status: 'snoozed', snoozed_until: newDate, occurs_on: newDate } : o)))
      setBanner({ type: 'success', title: 'Snoozed', message: `Snoozed to ${formatDate(newDate)}.` })
    } catch (e: any) {
      setBanner({ type: 'error', title: 'Failed', message: e?.message || 'Unable to snooze.' })
    }
  }

  const Row = ({ occ }: { occ: Occurrence }) => {
    const tx = occ.transaction_id ? txMap[occ.transaction_id] : null
    const [openPay, setOpenPay] = useState(false)
    const [openSnooze, setOpenSnooze] = useState(false)
    const [amt, setAmt] = useState<number>(tx?.amount || defaultAmount)
    const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 16))
    const [snoozeDate, setSnoozeDate] = useState<string>(occ.snoozed_until || occ.occurs_on)

    const chip = statusChip(occ.status)

    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', chip.cls)}>{chip.label}</span>
              {occ.status === 'snoozed' && occ.snoozed_until ? (
                <span className="text-xs text-muted-foreground">until {formatDate(occ.snoozed_until)}</span>
              ) : null}
            </div>
            <div className="mt-1 text-base font-medium text-foreground">{formatDate(occ.occurs_on)}</div>
            <div className="text-sm text-muted-foreground">{tx ? 'Paid amount' : 'Planned amount'}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-foreground">{formatKRW(tx ? tx.amount : defaultAmount)}</div>
            {tx ? (
              <div className="text-xs text-muted-foreground">on {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(tx.occurred_at))}</div>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {occ.status !== 'paid' && (
            <button
              onClick={() => setOpenPay((v) => !v)}
              className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Mark Paid
            </button>
          )}
          {!autoCreate && occ.status !== 'paid' && (
            <button
              onClick={() => confirmOcc(occ)}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Confirm
            </button>
          )}
          {occ.status !== 'paid' && (
            <button
              onClick={() => skipOcc(occ)}
              className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
            >
              Skip
            </button>
          )}
          {occ.status !== 'paid' && (
            <button
              onClick={() => setOpenSnooze((v) => !v)}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Snooze
            </button>
          )}
        </div>

        {/* Mark Paid panel */}
        {openPay && occ.status !== 'paid' && (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 animate-in fade-in-0 slide-in-from-top-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-foreground">
                Amount (KRW)
                <input
                  type="number"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                  value={amt}
                  onChange={(e) => setAmt(Number(e.target.value || 0))}
                  min={0}
                  step={100}
                />
              </label>
              <label className="text-sm font-medium text-foreground">
                Paid at
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  const now = new Date()
                  const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                  setPaidAt(isoLocal)
                }}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Set to now
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpenPay(false)}
                  className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => markPaid(occ, amt, paidAt ? new Date(paidAt).toISOString() : undefined)}
                  className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Snooze panel */}
        {openSnooze && occ.status !== 'paid' && (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 animate-in fade-in-0 slide-in-from-top-1">
            <label className="text-sm font-medium text-foreground">
              Snooze until
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                value={snoozeDate}
                onChange={(e) => setSnoozeDate(e.target.value)}
                min={todayStr}
              />
            </label>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpenSnooze(false)}
                className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => snoozeOcc(occ, snoozeDate)}
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      {banner && (
        <Alert className={cn('border', banner.type === 'error' ? 'border-destructive/50' : 'border-emerald-500/50')}>
          <AlertTitle>{banner.title}</AlertTitle>
          <AlertDescription>{banner.message}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="inline-flex rounded-full border border-input bg-background p-1 text-sm">
        <button
          onClick={() => setTab('upcoming')}
          className={cn('rounded-full px-4 py-1.5 transition', tab === 'upcoming' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          Upcoming
        </button>
        <button
          onClick={() => setTab('history')}
          className={cn('rounded-full px-4 py-1.5 transition', tab === 'history' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          History
        </button>
      </div>

      <Separator />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Alert className="border border-destructive/50">
          <AlertTitle>Unable to load</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
          No {tab === 'upcoming' ? 'upcoming' : 'historical'} occurrences yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((occ) => (
            <Row key={occ.id} occ={occ} />
          ))}
        </div>
      )}
    </div>
  )
}
