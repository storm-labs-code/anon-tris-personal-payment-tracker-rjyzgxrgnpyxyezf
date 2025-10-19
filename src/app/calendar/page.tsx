/**
 * CODE INSIGHT
 * This code's use case is to render the Calendar view for recurring occurrences, offering a month/week toggle,
 * range-based fetching, and a per-day bottom sheet to act on occurrences (mark paid, confirm, skip, snooze).
 * This code's full epic context is the Recurring Payments & Reminders epic, where occurrences are materialized
 * server-side and exposed via /api/occurrences endpoints. The page adheres to the data flow plan by delegating
 * reads/writes to those API routes and reflecting updates instantly in the UI.
 * This code's ui feel is minimal, modern, and mobile-first with calm transitions, clear KRW formatting,
 * and subtle, trustworthy feedback. It avoids header/footer/sidebar content and assumes those are provided by the layout.
 */

import Client from './client.tsx'
import { supabaseServer } from '@/utils/supabase/client-server'

export default async function CalendarPage() {
  const { data } = await supabaseServer.auth.getUser()
  const user = data?.user ?? null

  return (
    <section className="w-full">
      <Client userDisplayName={user?.user_metadata?.full_name || user?.email || ''} />
    </section>
  )
}
