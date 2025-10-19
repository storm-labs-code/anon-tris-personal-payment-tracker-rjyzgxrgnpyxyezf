/**
 * CODE INSIGHT
 * This code's use case is to render the occurrences list for a specific recurring rule, allowing the user to review upcoming and historical occurrences and take actions like Mark Paid, Confirm, Skip, and Snooze.
 * This code's full epic context is the Recurring Payments & Reminders flow, where rules generate occurrences and users act on them. It integrates with Supabase for data and respects the single-user scope via RLS.
 * This code's ui feel is calm, minimal, and mobile-first using clean cards, status chips, and inline action panels with smooth transitions and accessible controls.
 */

import Link from 'next/link'
import { supabaseServer } from '@/utils/supabase/client-server'
import { notFound } from 'next/navigation'
import { OccurrencesClient } from './client'

interface PageProps {
  params: { ruleId: string }
}

export default async function Page({ params }: PageProps) {
  const ruleId = params.ruleId

  const { data: auth } = await supabaseServer.auth.getUser()
  const user = auth?.user
  if (!user) {
    // Layout should handle redirect, but protect SSR rendering
    notFound()
  }

  const { data: rule, error } = await supabaseServer
    .from('recurring_transactions')
    .select(
      [
        'id',
        'amount',
        'auto_create_transactions',
        'payee',
        'payment_method',
        'category_id',
        'is_active',
        'frequency',
        'interval',
        'start_date',
        'end_date',
      ].join(', ')
    )
    .eq('id', ruleId)
    .eq('user_id', user.id)
    .single()

  if (error || !rule) {
    notFound()
  }

  const title = rule.payee || 'Recurring Rule'

  return (
    <main className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Occurrences</h1>
          <p className="text-sm text-muted-foreground truncate">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/recurring/${ruleId}`}
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Edit rule
          </Link>
          <Link
            href="/recurring"
            className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Back
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Default amount</p>
            <p className="text-lg font-semibold text-foreground">₩{new Intl.NumberFormat('ko-KR').format(Number(rule.amount || 0))}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {rule.is_active ? 'Active' : 'Inactive'} • {String(rule.frequency).toLowerCase()}
            </span>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: rule.auto_create_transactions ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)', color: rule.auto_create_transactions ? '#16a34a' : '#64748b' }}>
              {rule.auto_create_transactions ? 'Auto-create ON' : 'Auto-create OFF'}
            </span>
          </div>
        </div>
      </section>

      <OccurrencesClient
        ruleId={rule.id}
        defaultAmount={Number(rule.amount || 0)}
        autoCreate={Boolean(rule.auto_create_transactions)}
        payee={rule.payee || ''}
        paymentMethod={rule.payment_method || ''}
        categoryId={rule.category_id || ''}
      />

      <div className="flex items-center justify-center gap-6 pt-2 text-sm text-muted-foreground">
        <Link href="/upcoming" className="hover:text-foreground">Upcoming</Link>
        <Link href="/calendar" className="hover:text-foreground">Calendar</Link>
      </div>
    </main>
  )
}
