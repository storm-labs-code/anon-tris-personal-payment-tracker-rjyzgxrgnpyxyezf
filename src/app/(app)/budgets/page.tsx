/**
 * CODE INSIGHT
 * This code's use case is the budgets root redirector that computes the current month based on an available timezone hint and immediately redirects to /budgets/{YYYY-MM}.
 * This code's full epic context is the Budgets Overview flow where the root path forwards users to the month-scoped page for fetching summaries and editing budgets.
 * This code's ui feel is non-rendering; fast server-side navigation with no visual output, ensuring a smooth mobile-first PWA experience.
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default function Page() {
  const h = headers()
  const tzHeader =
    h.get('x-timezone') ||
    h.get('x-user-timezone') ||
    h.get('timezone') ||
    undefined

  const now = new Date()
  let yearMonth: string

  try {
    yearMonth = new Intl.DateTimeFormat('en-CA', {
      timeZone: tzHeader || 'UTC',
      year: 'numeric',
      month: '2-digit',
    }).format(now)
  } catch {
    yearMonth = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
    }).format(now)
  }

  redirect(`/budgets/${yearMonth}`)
}
