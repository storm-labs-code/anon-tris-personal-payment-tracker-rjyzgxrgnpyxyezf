'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/utils/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { updateRecurringRule, deleteRecurringRule } from './action'

type RecurringTransaction = {
  id: string
  user_id: string
  amount: number
  category_id: string | null
  payee: string | null
  payment_method: string
  notes: string | null
  frequency: 'daily' | 'weekly' | 'monthly' | string
  interval: number
  start_date: string
  end_date: string | null
  is_active: boolean
  reminder_enabled: boolean
  reminder_time: string | null
  auto_create_transactions: boolean
  created_at: string
  updated_at: string
}

type Category = { id: string; name: string }

type Occurrence = {
  id: string
  occurs_on: string
  status: string
  transaction_id: string | null
}

export default function Client({
  initialRule,
  categories,
  occurrencesPreview,
}: {
  initialRule: RecurringTransaction
  categories: Category[]
  occurrencesPreview: Occurrence[]
}) {
  const router = useRouter()
  const [rule, setRule] = useState<RecurringTransaction>(initialRule)
  const [amountInput, setAmountInput] = useState(() => String(initialRule.amount))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setRule(initialRule)
    setAmountInput(String(initialRule.amount))
  }, [initialRule])

  const title = useMemo(() => {
    if (rule.payee && rule.payee.trim().length > 0) return rule.payee
    return 'Recurring payment'
  }, [rule.payee])

  const currencyFormat = useMemo(
    () => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }),
    []
  )

  const formattedAmount = useMemo(() => {
    const n = Number(amountInput.replace(/[^0-9]/g, ''))
    return isNaN(n) ? '' : currencyFormat.format(n)
  }, [amountInput, currencyFormat])

  const handleSave = async () => {
    setError(null)
    setSuccess(null)

    const cleanedAmount = Number(amountInput.replace(/[^0-9]/g, ''))
    if (!cleanedAmount || cleanedAmount <= 0) {
      setError('Please enter a valid amount (KRW).')
      return
    }
    if (!rule.frequency) {
      setError('Please select a frequency.')
      return
    }
    if (!rule.start_date) {
      setError('Please select a start date.')
      return
    }

    startTransition(async () => {
      try {
        const updates: Partial<RecurringTransaction> = {
          amount: cleanedAmount,
          category_id: rule.category_id || null,
          payee: rule.payee || null,
          payment_method: rule.payment_method,
          notes: rule.notes || null,
          frequency: rule.frequency,
          interval: Math.max(1, Number(rule.interval) || 1),
          start_date: rule.start_date,
          end_date: rule.end_date || null,
          is_active: !!rule.is_active,
          reminder_enabled: !!rule.reminder_enabled,
          reminder_time: rule.reminder_time ? ensureTime(rule.reminder_time) : null,
          auto_create_transactions: !!rule.auto_create_transactions,
        }
        const updated = await updateRecurringRule(rule.id, updates)
        setRule(updated as RecurringTransaction)
        setSuccess('Saved successfully')
        // Refresh data for server components (occurrence preview may change elsewhere)
        router.refresh()
      } catch (e: any) {
        setError(e?.message || 'Failed to save changes')
      }
    })
  }

  const handleDelete = async () => {
    setError(null)
    setSuccess(null)
    const ok = window.confirm('Delete this recurring rule? This action cannot be undone.')
    if (!ok) return

    startTransition(async () => {
      try {
        await deleteRecurringRule(rule.id)
        router.push('/recurring')
      } catch (e: any) {
        setError(e?.message || 'Failed to delete recurring rule')
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="p-4 md:p-6 border-b">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">Edit rule details and preferences</p>
        </div>
        <div className="p-4 md:p-6 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>There was a problem</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border border-primary/20 bg-primary/5 text-primary">
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1">
              <label htmlFor="amount" className="block text-sm font-medium text-foreground">
                Amount (KRW)
              </label>
              <div className="relative mt-2">
                <input
                  id="amount"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="e.g., 12000"
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {formattedAmount}
                </div>
              </div>
            </div>
            <div className="col-span-1">
              <label htmlFor="category" className="block text-sm font-medium text-foreground">
                Category
              </label>
              <select
                id="category"
                value={rule.category_id ?? ''}
                onChange={(e) => setRule((r) => ({ ...r, category_id: e.target.value || null }))}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payee & Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1">
              <label htmlFor="payee" className="block text-sm font-medium text-foreground">
                Payee
              </label>
              <input
                id="payee"
                value={rule.payee ?? ''}
                onChange={(e) => setRule((r) => ({ ...r, payee: e.target.value }))}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., SKT"
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="payment_method" className="block text-sm font-medium text-foreground">
                Payment method
              </label>
              <input
                id="payment_method"
                value={rule.payment_method}
                onChange={(e) => setRule((r) => ({ ...r, payment_method: e.target.value }))}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., card, cash"
              />
              <p className="mt-1 text-xs text-muted-foreground">Must match one of your allowed payment methods.</p>
            </div>
          </div>

          {/* Frequency & Interval */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1">
              <label htmlFor="frequency" className="block text-sm font-medium text-foreground">
                Frequency
              </label>
              <select
                id="frequency"
                value={rule.frequency}
                onChange={(e) => setRule((r) => ({ ...r, frequency: e.target.value as any }))}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {ensureFrequencyOptions(rule.frequency).map((opt) => (
                  <option key={opt} value={opt}>
                    {capital(opt)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <label htmlFor="interval" className="block text-sm font-medium text-foreground">
                Every
              </label>
              <input
                id="interval"
                type="number"
                min={1}
                value={rule.interval}
                onChange={(e) => setRule((r) => ({ ...r, interval: Math.max(1, Number(e.target.value) || 1) }))}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">Interval in {rule.frequency}s</p>
            </div>
            <div className="col-span-1">
              <label htmlFor="is_active" className="block text-sm font-medium text-foreground">
                Status
              </label>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRule((r) => ({ ...r, is_active: true }))}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm transition',
                    rule.is_active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'
                  )}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setRule((r) => ({ ...r, is_active: false }))}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm transition',
                    !rule.is_active ? 'border-destructive bg-destructive text-destructive-foreground' : 'bg-background hover:bg-accent'
                  )}
                >
                  Paused
                </button>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1">
              <label htmlFor="start_date" className="block text-sm font-medium text-foreground">
                Start date
              </label>
              <input
                id="start_date"
                type="date"
                value={rule.start_date || ''}
                onChange={(e) => setRule((r) => ({ ...r, start_date: e.target.value }))}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="end_date" className="block text-sm font-medium text-foreground">
                End date (optional)
              </label>
              <input
                id="end_date"
                type="date"
                value={rule.end_date || ''}
                onChange={(e) => setRule((r) => ({ ...r, end_date: e.target.value || null }))}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Reminders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-foreground">Reminders</label>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRule((r) => ({ ...r, reminder_enabled: true }))}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm transition',
                    rule.reminder_enabled ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'
                  )}
                >
                  On
                </button>
                <button
                  type="button"
                  onClick={() => setRule((r) => ({ ...r, reminder_enabled: false }))}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm transition',
                    !rule.reminder_enabled ? 'border-muted-foreground bg-muted text-muted-foreground' : 'bg-background hover:bg-accent'
                  )}
                >
                  Off
                </button>
              </div>
            </div>
            <div className="col-span-1">
              <label htmlFor="reminder_time" className="block text-sm font-medium text-foreground">
                Reminder time
              </label>
              <input
                id="reminder_time"
                type="time"
                disabled={!rule.reminder_enabled}
                value={rule.reminder_time ?? ''}
                onChange={(e) => setRule((r) => ({ ...r, reminder_time: e.target.value }))}
                className={cn(
                  'mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary',
                  !rule.reminder_enabled && 'opacity-60'
                )}
              />
              <p className="mt-1 text-xs text-muted-foreground">Global reminder preferences can be set in Notification settings.</p>
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-foreground">Auto-create transactions</label>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRule((r) => ({ ...r, auto_create_transactions: true }))}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm transition',
                    rule.auto_create_transactions ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'
                  )}
                >
                  Enabled
                </button>
                <button
                  type="button"
                  onClick={() => setRule((r) => ({ ...r, auto_create_transactions: false }))}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm transition',
                    !rule.auto_create_transactions ? 'border-muted-foreground bg-muted text-muted-foreground' : 'bg-background hover:bg-accent'
                  )}
                >
                  Disabled
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={rule.notes ?? ''}
              onChange={(e) => setRule((r) => ({ ...r, notes: e.target.value }))}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Optional notes for this rule"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="w-full sm:w-auto rounded-lg border border-destructive text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive hover:text-destructive-foreground transition"
              disabled={isPending}
            >
              Delete rule
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleSave}
              className={cn(
                'w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 transition',
                isPending && 'animate-pulse'
              )}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </section>

      {/* Occurrence Preview */}
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="p-4 md:p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base md:text-lg font-semibold">Upcoming occurrences</h2>
            <p className="text-sm text-muted-foreground mt-1">A quick look at what’s next</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/recurring/${rule.id}/occurrences`}
              className="text-sm text-primary hover:underline"
            >
              View all
            </a>
          </div>
        </div>
        <div className="p-4 md:p-6">
          {occurrencesPreview.length === 0 ? (
            <div className="text-sm text-muted-foreground">No upcoming occurrences yet.</div>
          ) : (
            <ul className="divide-y">
              {occurrencesPreview.map((o) => (
                <li key={o.id} className="py-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{formatDate(o.occurs_on)}</span>
                    <span className="text-xs text-muted-foreground">{currencyFormat.format(Number(amountInput || rule.amount))}</span>
                  </div>
                  <span className={cn('text-xs rounded-full px-2 py-1 border', badgeClass(o.status))}>{capital(o.status)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between">
            <a
              href={`/notifications?ruleId=${rule.id}`}
              className="text-sm text-primary hover:underline"
            >
              Notification settings
            </a>
            <a href="/upcoming" className="text-sm text-muted-foreground hover:text-foreground transition">Go to Upcoming</a>
          </div>
        </div>
      </section>
    </div>
  )
}

function capital(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function ensureFrequencyOptions(current: string) {
  const base = ['daily', 'weekly', 'monthly']
  if (current && !base.includes(current)) return [current, ...base]
  return base
}

function ensureTime(t: string) {
  // Ensure HH:mm:ss for Postgres time
  if (!t) return t
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`
  return t
}

function badgeClass(status: string) {
  switch ((status || '').toLowerCase()) {
    case 'paid':
    case 'confirmed':
      return 'border-green-500 text-green-600 bg-green-50'
    case 'snoozed':
      return 'border-amber-500 text-amber-600 bg-amber-50'
    case 'skipped':
      return 'border-muted text-muted-foreground bg-muted'
    default:
      return 'border-primary/30 text-primary bg-primary/10'
  }
}

function formatDate(d: string) {
  try {
    const [y, m, day] = d.split('-')
    const date = new Date(Number(y), Number(m) - 1, Number(day))
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(date)
  } catch {
    return d
  }
}
