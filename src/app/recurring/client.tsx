'use client'

/**
 * CODE INSIGHT
 * Client component for listing recurring rules with inline toggles and smooth interactions.
 * Handles optimistic updates for auto-create and reminders toggles, renders responsive cards, and links to details and occurrences.
 * UI emphasizes clarity with KRW formatting, subtle animations, and accessible controls.
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client-browser'
import { updateRecurringRule } from './action'
import type { RecurringRule } from './page'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

type Props = {
  initialRules: RecurringRule[]
}

type RowBusy = Record<string, boolean>

export default function Client({ initialRules }: Props) {
  const router = useRouter()
  const [rules, setRules] = useState<RecurringRule[] | null>(initialRules ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<RowBusy>({})
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState<boolean>(!initialRules?.length)

  // Refresh client-side to ensure freshest list when landing from cache.
  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const { data, error } = await supabaseBrowser
        .from('recurring_transactions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (!mounted) return
      if (error) {
        setError('Unable to load recurring rules.')
        setLoading(false)
        return
      }
      setRules((data as unknown as RecurringRule[]) || [])
      setLoading(false)
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const formatter = useMemo(
    () => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }),
    []
  )

  function formatAmount(value: number | string) {
    const n = typeof value === 'number' ? value : parseInt(value || '0', 10)
    return formatter.format(isNaN(n) ? 0 : n)
  }

  function titleForRule(rule: RecurringRule) {
    return rule.payee?.trim() || 'Recurring payment'
  }

  function scheduleSummary(rule: RecurringRule) {
    const freq = (rule.frequency || '').toLowerCase()
    const every = rule.interval && rule.interval > 1 ? `${rule.interval} ` : ''
    const when = (() => {
      switch (freq) {
        case 'daily':
          return `${every}day${rule.interval > 1 ? 's' : ''}`
        case 'weekly':
          return `${every}week${rule.interval > 1 ? 's' : ''}`
        case 'monthly':
          return `${every}month${rule.interval > 1 ? 's' : ''}`
        default:
          return freq ? freq : 'custom'
      }
    })()
    const start = rule.start_date ? new Date(rule.start_date).toLocaleDateString('ko-KR') : ''
    const end = rule.end_date ? new Date(rule.end_date).toLocaleDateString('ko-KR') : null
    return `${when}${start ? ` • from ${start}` : ''}${end ? ` • until ${end}` : ''}`
  }

  async function handleToggle(
    rule: RecurringRule,
    field: 'auto_create_transactions' | 'reminder_enabled',
    value: boolean
  ) {
    setError(null)
    setBusy((b) => ({ ...b, [rule.id]: true }))

    // optimistic update
    setRules((prev) =>
      (prev || []).map((r) => (r.id === rule.id ? { ...r, [field]: value } : r))
    )

    try {
      await updateRecurringRule({ id: rule.id, patch: { [field]: value } })
      startTransition(() => {
        // Revalidate RSC and any dependent caches
        router.refresh()
      })
    } catch (e) {
      // revert on error
      setRules((prev) =>
        (prev || []).map((r) => (r.id === rule.id ? { ...r, [field]: !value } : r))
      )
      setError('Could not save your change. Please try again.')
    } finally {
      setBusy((b) => ({ ...b, [rule.id]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert className="bg-destructive/10 border-destructive text-destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (!rules || rules.length === 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="mt-3">
                <Skeleton className="h-4 w-56" />
              </div>
              <Separator className="my-3" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && rules && rules.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No recurring payments yet.</p>
          <div className="mt-3">
            <Link
              href="/recurring/new"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-primary-foreground shadow hover:shadow-md transition"
            >
              Create your first rule
            </Link>
          </div>
        </div>
      )}

      {!loading && rules && rules.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="group rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/recurring/${rule.id}`}
                  className="flex-1 min-w-0"
                  aria-label={`Edit ${titleForRule(rule)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="truncate font-medium text-base">{titleForRule(rule)}</h2>
                    <div className="text-right text-sm font-semibold text-foreground/90">
                      {formatAmount(rule.amount)}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground truncate">
                    {scheduleSummary(rule)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground/80">Method: {rule.payment_method}</div>
                </Link>
              </div>

              <Separator className="my-3" />

              <div className="flex flex-wrap items-center gap-2">
                <TogglePill
                  label="Auto-create"
                  checked={!!rule.auto_create_transactions}
                  disabled={!!busy[rule.id] || isPending}
                  onChange={(v) => handleToggle(rule, 'auto_create_transactions', v)}
                />
                <TogglePill
                  label="Reminders"
                  checked={!!rule.reminder_enabled}
                  disabled={!!busy[rule.id] || isPending}
                  onChange={(v) => handleToggle(rule, 'reminder_enabled', v)}
                />

                <div className="ms-auto flex items-center gap-2 text-sm">
                  <Link
                    href={`/recurring/${rule.id}/occurrences`}
                    className="text-primary hover:underline"
                  >
                    Occurrences
                  </Link>
                  <span className="text-muted-foreground select-none">·</span>
                  <Link
                    href={`/recurring/${rule.id}`}
                    className="text-muted-foreground hover:text-foreground transition"
                    aria-label="Edit details"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TogglePill({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
        checked
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'bg-secondary text-foreground border-border hover:border-foreground/30',
        disabled ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.98]'
      ].join(' ')}
    >
      <span
        className={[
          'h-4 w-7 rounded-full relative transition-colors',
          checked ? 'bg-primary-foreground/20' : 'bg-foreground/10',
        ].join(' ')}
        aria-hidden="true"
      >
        <span
          className={[
            'absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-current transition-all',
            checked ? 'right-0.5' : 'left-0.5',
          ].join(' ')}
        />
      </span>
      <span className="font-medium">{label}</span>
    </button>
  )
}
