/**
 * CODE INSIGHT
 * This code's use case is the Upcoming inbox page that lists all due/soon recurring occurrences,
 * enabling quick actions (Mark Paid, Confirm, Skip, Snooze) with smooth mobile-first interactions.
 * This code's full epic context is the Recurring Payments & Reminders flow, tying occurrences to
 * recurring transactions and transactions tables while respecting user scoping via Supabase Auth.
 * This code's ui feel is calm, clean, and minimal with KRW formatting, subtle motion, and
 * responsive cards grouped by day, designed for quick thumb-driven actions on mobile.
 */

import { supabaseServer } from '@/utils/supabase/client-server'
import Client from './client'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const focus = typeof searchParams?.focus === 'string' ? searchParams?.focus : null

  // Ensure user session exists; layout should redirect if not authenticated in the wider app.
  // We keep the check lightweight and avoid fetching heavy data on the server here.
  const { data: auth } = await supabaseServer.auth.getUser()
  const userId = auth?.user?.id ?? null

  return (
    <main className="w-full h-full">
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-3">
          <h1 className="text-2xl font-semibold tracking-tight">Upcoming</h1>
          <p className="text-sm text-muted-foreground mt-1">All due and soon items across your rules</p>
        </div>
        <Client focusId={focus} userId={userId} />
      </section>
    </main>
  )
}
