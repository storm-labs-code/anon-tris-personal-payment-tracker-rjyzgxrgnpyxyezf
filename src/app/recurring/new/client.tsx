'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Category = { id: string; name: string }

type Props = {
  categories: Category[]
  defaultTimeZone?: string
}

type Freq = 'daily' | 'weekly' | 'monthly'

type PaymentMethod = 'card' | 'bank_transfer' | 'cash' | 'mobile' | 'other'

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'other', label: 'Other' },
]

function krwFormat(value: number) {
  try {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value)
  } catch {
    return `₩${value.toLocaleString('ko-KR')}`
  }
}

function parseAmountToInt(input: string): number {
  const digits = input.replace(/[^0-9]/g, '')
  if (!digits) return 0
  const n = Number(digits)
  return Number.isFinite(n) ? n : 0
}

function useTimeZones(defaultTZ?: string) {
  const [tzs, setTzs] = useState<string[]>([])
  const [browserTZ, setBrowserTZ] = useState<string | undefined>(undefined)

  useEffect(() => {
    setBrowserTZ(Intl.DateTimeFormat().resolvedOptions().timeZone)
    // @ts-ignore - supportedValuesOf may not be typed depending on TS lib
    const hasSupportedValues = typeof Intl.supportedValuesOf === 'function'
    if (hasSupportedValues) {
      try {
        // @ts-ignore
        const list: string[] = Intl.supportedValuesOf('timeZone')
        setTzs(Array.isArray(list) && list.length ? list : [])
      } catch {
        setTzs([])
      }
    }
  }, [])

  const fallback = useMemo(
    () => ['Asia/Seoul', 'UTC', 'Asia/Tokyo', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles'],
    []
  )

  const all = tzs.length ? tzs : fallback
  const initial = defaultTZ || browserTZ || 'Asia/Seoul'

  return { timeZones: all, initial }
}

export default function Client({ categories, defaultTimeZone }: Props) {
  const router = useRouter()

  // Basics
  const [title, setTitle] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [payee, setPayee] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [notes, setNotes] = useState('')

  // Schedule
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [freq, setFreq] = useState<Freq>('monthly')
  const [interval, setInterval] = useState<number>(1)
  const [byweekday, setByweekday] = useState<number[]>([]) // 0=Sun ... 6=Sat
  const [monthlyMode, setMonthlyMode] = useState<'date' | 'weekday'>('date')
  const [bymonthday, setBymonthday] = useState<number | ''>('')
  const { timeZones, initial } = useTimeZones(defaultTimeZone)
  const [timezone, setTimezone] = useState<string>('')

  // Notifications
  const [autoCreate, setAutoCreate] = useState(false)
  const [remindEnabled, setRemindEnabled] = useState(false)
  const [remindOffset, setRemindOffset] = useState<number>(0) // minutes
  const [remindTime, setRemindTime] = useState<string>('09:00')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!timezone) setTimezone(initial)
  }, [initial, timezone])

  useEffect(() => {
    // Set reasonable defaults when schedule changes
    if (freq === 'weekly' && byweekday.length === 0) {
      const dow = new Date().getDay() // 0-6
      setByweekday([dow])
    }
    if (freq === 'monthly') {
      // default monthly date from startDate or today
      const d = startDate ? new Date(startDate) : new Date()
      const day = d.getDate()
      if (monthlyMode === 'date' && bymonthday === '') setBymonthday(day)
    }
  }, [freq, startDate, monthlyMode, bymonthday])

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekdaysKo = ['일', '월', '화', '수', '목', '금', '토']

  function toggleWeekday(idx: number) {
    setByweekday(prev => (prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx].sort((a, b) => a - b)))
  }

  function onAmountChange(v: string) {
    const digits = v.replace(/[^0-9]/g, '')
    setAmountRaw(digits)
  }

  function validate(): string | null {
    if (!title.trim()) return 'Please enter a title.'
    const amt = parseAmountToInt(amountRaw)
    if (!amt || amt <= 0) return 'Amount must be greater than 0.'
    if (!paymentMethod) return 'Please select a payment method.'
    if (!startDate) return 'Please select a start date.'
    if (endDate && startDate && new Date(endDate) < new Date(startDate)) return 'End date cannot be before start date.'
    if (freq === 'weekly' && byweekday.length === 0) return 'Pick at least one weekday for a weekly rule.'
    if (freq === 'monthly' && monthlyMode === 'date') {
      const d = Number(bymonthday)
      if (!d || d < 1 || d > 31) return 'Choose a valid monthly day (1-31).'
    }
    if (!timezone) return 'Please select a time zone.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const err = validate()
    if (err) {
      setError(err)
      return
    }

    const payload: any = {
      title: title.trim(),
      amount: parseAmountToInt(amountRaw),
      category_id: categoryId || null,
      payee: payee.trim() || null,
      payment_method: paymentMethod,
      notes: notes.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
      freq,
      interval: Number(interval) || 1,
      byweekday: freq === 'weekly' ? byweekday : [],
      bymonthday: freq === 'monthly' && monthlyMode === 'date' ? [Number(bymonthday)] : [],
      monthly_mode: freq === 'monthly' ? monthlyMode : null,
      timezone,
      auto_create: autoCreate,
      remind_enabled: remindEnabled,
      remind_offset_minutes: remindEnabled ? Number(remindOffset) : 0,
      default_remind_time: remindEnabled ? remindTime : null,
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to create rule')
      }
      const data = await res.json()
      const ruleId = data?.rule?.id
      if (ruleId) {
        router.replace(`/recurring/${ruleId}?created=1`)
      } else {
        // Fallback: go back to list
        router.replace('/recurring')
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          <h2 className="font-medium text-base">Basics</h2>
          <p className="text-sm text-muted-foreground mt-1">Core details for your rule.</p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Title<span className="text-destructive">*</span></label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Rent, Gym, Netflix"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Amount (₩)<span className="text-destructive">*</span></label>
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
                <span className="text-muted-foreground">₩</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amountRaw}
                  onChange={e => onAmountChange(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent outline-none text-right"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{krwFormat(parseAmountToInt(amountRaw) || 0)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Uncategorized</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Payee</label>
              <input
                value={payee}
                onChange={e => setPayee(e.target.value)}
                placeholder="e.g., Landlord, Gym Co., Netflix"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Payment Method<span className="text-destructive">*</span></label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          <h2 className="font-medium text-base">Schedule</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose how often and when this repeats.</p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date<span className="text-destructive">*</span></label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave empty if ongoing.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Frequency<span className="text-destructive">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {(['daily','weekly','monthly'] as Freq[]).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFreq(f)}
                    className={`rounded-lg border px-3 py-2 text-sm transition ${freq===f? 'bg-primary text-primary-foreground border-primary shadow-sm':'bg-background border-input hover:bg-accent hover:text-accent-foreground'}`}
                  >
                    {f.charAt(0).toUpperCase()+f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Interval</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={interval}
                  onChange={e => setInterval(Math.max(1, Number(e.target.value)))}
                  className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">Every {interval} {freq}{interval>1?'s':''}</span>
              </div>
            </div>

            {freq === 'weekly' && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-2">Weekdays<span className="text-destructive">*</span></label>
                <div className="grid grid-cols-7 gap-2">
                  {weekdays.map((w, i) => (
                    <button
                      type="button"
                      key={w}
                      onClick={() => toggleWeekday(i)}
                      className={`rounded-lg border px-2 py-2 text-sm transition ${byweekday.includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-accent hover:text-accent-foreground'}`}
                      aria-pressed={byweekday.includes(i)}
                      title={weekdaysKo[i]}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {freq === 'monthly' && (
              <div className="sm:col-span-2 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium">Monthly Mode</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMonthlyMode('date')}
                      className={`rounded-full px-3 py-1 text-xs border transition ${monthlyMode==='date' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-accent hover:text-accent-foreground'}`}
                    >By date</button>
                    <button
                      type="button"
                      onClick={() => setMonthlyMode('weekday')}
                      className={`rounded-full px-3 py-1 text-xs border transition ${monthlyMode==='weekday' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-accent hover:text-accent-foreground'}`}
                    >Same weekday</button>
                  </div>
                </div>
                {monthlyMode === 'date' ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">Day of Month<span className="text-destructive">*</span></label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={bymonthday}
                      onChange={e => setBymonthday(e.target.value === '' ? '' : Math.min(31, Math.max(1, Number(e.target.value))))}
                      className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Select a day (1-31). Defaults to the start date's day.</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Occurs on the same weekday and week position as the start date (e.g., 3rd Tue).</div>
                )}
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Time Zone<span className="text-destructive">*</span></label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                {timeZones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          <h2 className="font-medium text-base">Notifications</h2>
          <p className="text-sm text-muted-foreground mt-1">Enable reminders before due time and auto-create transactions on due date.</p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-input bg-background p-3">
              <div>
                <div className="text-sm font-medium">Auto-create</div>
                <div className="text-xs text-muted-foreground">Automatically create a transaction when due.</div>
              </div>
              <button
                type="button"
                onClick={() => setAutoCreate(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${autoCreate ? 'bg-primary' : 'bg-muted'}`}
                aria-pressed={autoCreate}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${autoCreate ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-input bg-background p-3">
              <div>
                <div className="text-sm font-medium">Reminders</div>
                <div className="text-xs text-muted-foreground">Notify before due time.</div>
              </div>
              <button
                type="button"
                onClick={() => setRemindEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${remindEnabled ? 'bg-primary' : 'bg-muted'}`}
                aria-pressed={remindEnabled}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${remindEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            {remindEnabled && (
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Reminder Time</label>
                  <input
                    type="time"
                    value={remindTime}
                    onChange={e => setRemindTime(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Offset</label>
                  <select
                    value={String(remindOffset)}
                    onChange={e => setRemindOffset(Number(e.target.value))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="0">At time</option>
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">60 minutes before</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <a
            href="/recurring"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition w-1/3 sm:w-auto"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={submitting}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition shadow-sm ${submitting ? 'bg-primary/80' : 'bg-primary hover:bg-primary/90'} text-primary-foreground w-full sm:w-auto`}
          >
            {submitting ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>
    </form>
  )
}
