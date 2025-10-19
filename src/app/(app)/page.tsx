/**
 * CODE INSIGHT
 * This code's use case is the Home Dashboard page for Tris, rendering a server shell that mounts a client widget.
 * This code's full epic context is to show summary totals (today/week/month), category chips, and recent items via demo APIs using SWR with loading skeletons, error states, and empty states. It links to Transactions, Reports, and provides a FAB to add a transaction.
 * This code's ui feel is calm, minimal, mobile-first with clear KRW formatting, modern cards, and subtle motion, without header/footer/sidebar which are provided by layout.
 */

import ClientHomeWidget from './client.tsx'

export default async function Page() {
  return (
    <section className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <div className="text-sm text-muted-foreground">KRW · Demo</div>
        </div>
        <ClientHomeWidget />
      </div>
    </section>
  )
}
