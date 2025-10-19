/**
 * CODE INSIGHT
 * This code's use case is the Reports Overview page showing aggregated totals with a granularity toggle (Daily/Weekly/Monthly),
 * loading data via the reports aggregate API and enabling drilldown navigation by tapping chart bars.
 * This code's full epic context is the Reports epic where URL search params are the single source of truth for filters, using
 * client-side data fetching (React Query) and Supabase Realtime to keep the UI instantly updated on transaction changes.
 * This code's ui feel is calm, modern, and mobile-first with sleek cards, clear KRW formatting, subtle animations, and intuitive interactions.
 */

import Client from './client'

export default function Page() {
  return <Client />
}
