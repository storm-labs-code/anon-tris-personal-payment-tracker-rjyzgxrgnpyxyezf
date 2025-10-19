/**
 * CODE INSIGHT
 * This code's use case is to render the Recurring Rules list page, showing all recurring payment rules for the signed-in user with inline toggles for auto-create and reminders, and navigation to rule details and occurrences.
 * This code's full epic context is the Recurring & Reminders epic, serving as the central list where users manage recurring payment behaviors and quick settings in a mobile-first PWA.
 * This code's ui feel is clean, calm, and responsive with card-based list items, smooth transitions, and an accessible floating action button for creating new rules.
 */

import Link from 'next/link'
import { supabaseServer } from '@/utils/supabase/client-server'
import Client from './client'

export type RecurringRule = {
  id: string
  user_id: string
  amount: number | string
  category_id: string | null
  payee: string | null
  payment_method: string
  notes: string | null
  frequency: string
  interval: number
  start_date: string
  end_date: string | null
  is_active: boolean
  reminder_enabled: boolean
  reminder_time: string | null
  created_at: string
  updated_at: string
  auto_create_transactions: boolean
}

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { data: userRes } = await supabaseServer.auth.getUser()
  const user = userRes?.user

  let rules: RecurringRule[] = []

  if (user) {
    const { data } = await supabaseServer
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (data) {
      rules = data as unknown as RecurringRule[]
    }
  }

  return (
    <main className="relative w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Recurring payments</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/upcoming" className="text-primary hover:underline">Upcoming</Link>
          <span className="text-muted-foreground">/</span>
          <Link href="/calendar" className="text-primary hover:underline">Calendar</Link>
          <span className="text-muted-foreground">/</span>
          <Link href="/notifications" className="text-primary hover:underline">Notifications</Link>
        </div>
      </div>

      <Client initialRules={rules} />

      <Link
        href="/recurring/new"
        className="fixed md:sticky md:float-right md:top-0 md:mt-2 bottom-24 right-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg hover:shadow-xl active:scale-[0.98] transition focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Create new recurring rule"
      >
        <span className="text-lg leading-none">＋</span>
        <span className="font-medium">New</span>
      </Link>
    </main>
  )
}
