/**
 * CODE INSIGHT
 * This code's use case is to render the Notifications settings page, providing global reminder toggles,
 * per-rule reminder/auto-create toggles, and web push enable/disable with test notification actions.
 * This code's full epic context is the Recurring & Notifications Epic, integrating Supabase Auth/DB and
 * web push APIs. It strictly queries existing schema tables (user_settings, recurring_transactions, push_subscriptions)
 * and uses provided API routes for push subscription actions.
 * This code's ui feel is calm, modern, and mobile-first with card layouts, smooth toggles, and clear feedback.
 */

import { supabaseServer } from '@/utils/supabase/client-server'
import NotificationsClient from './client'
import Link from 'next/link'

export default async function Page() {
  const { data: auth } = await supabaseServer.auth.getUser()
  const user = auth?.user

  if (!user) {
    // RLS/Global auth gate should redirect unauth users in layout/middleware.
    // Render minimal fallback to avoid crashing if reached.
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-xl border bg-card text-card-foreground p-4 sm:p-6">
            <h1 className="text-xl font-semibold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-2">Please sign in to manage your notification settings.</p>
            <div className="mt-4">
              <Link href="/upcoming" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90">Go to Upcoming</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const [{ data: settingsRow }, { data: rules }, { data: lastSub } ] = await Promise.all([
    supabaseServer
      .from('user_settings')
      .select('notifications_enabled')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabaseServer
      .from('recurring_transactions')
      .select('id, amount, payee, reminder_enabled, auto_create_transactions')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabaseServer
      .from('push_subscriptions')
      .select('updated_at, endpoint, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const remindersEnabled = !!settingsRow?.notifications_enabled

  const safeRules = (rules ?? []).map((r) => ({
    id: r.id as string,
    payee: (r as any).payee as string | null,
    amount: (r as any).amount as number | string,
    reminder_enabled: !!(r as any).reminder_enabled,
    auto_create_transactions: !!(r as any).auto_create_transactions,
  }))

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl border bg-card text-card-foreground p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Notifications & Reminders</h1>
              <p className="text-sm text-muted-foreground mt-1">Control reminders for upcoming payments, manage push permissions, and fine-tune rule-level alerts.</p>
            </div>
            <div className="hidden sm:flex gap-2">
              <Link href="/upcoming" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">Upcoming</Link>
              <Link href="/recurring" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">Recurring</Link>
            </div>
          </div>
        </div>

        <NotificationsClient
          initialSettings={{ remindersEnabled }}
          rules={safeRules}
          lastSubscriptionUpdatedAt={lastSub?.updated_at ?? null}
        />

        <div className="sm:hidden flex gap-2">
          <Link href="/upcoming" className="flex-1 inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">Upcoming</Link>
          <Link href="/recurring" className="flex-1 inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">Recurring</Link>
        </div>
      </div>
    </div>
  )
}
